import { sql } from '@payloadcms/db-postgres'
import { classifyIncident, summarizeClassification } from '@/lib/incident-classification'
import { buildReconstructedEvents } from '@/lib/status-reconstruction'

/**
 * Nachrechnung des Statusprotokolls vor dem ersten Betriebseintrag aus den Vorfällen (Konzept 5), wiederholbar.
 * Löscht nur Zeilen mit source = 'reconstructed' und schreibt sie neu. Die Zeilen mit source = 'operation' bleiben.
 * Das Feld `impact` der Vorfälle wird nicht gelesen. Eine Einordnung von Hand (`availability_class`) hat Vorrang.
 * Bei `dryRun: true` wird nichts geschrieben.
 */
export type SqlRunner = {
  execute: (query: ReturnType<typeof sql>) => Promise<{ rows: unknown[] }>
  /** Vorhanden bei Drizzle. Löschen und Einfügen laufen darin, damit ein Fehler das Protokoll nicht halb gefüllt lässt. */
  transaction?: <T>(fn: (tx: SqlRunner) => Promise<T>) => Promise<T>
}

export type RebuildResult = {
  dryRun: boolean
  incidents: number
  counts: Record<string, number>
  reconstructedBefore: number
  reconstructedAfter: number
  unsure: number
  withoutService: number
}

const INSERT_BATCH = 200

export async function rebuildStatusLog(db: SqlRunner, options: { dryRun: boolean }): Promise<RebuildResult> {
  const incidentRows = (
    await db.execute(sql`
      SELECT i.id,
             i.title,
             i.availability_class,
             EXTRACT(EPOCH FROM i.created_at) * 1000 AS from_ms,
             EXTRACT(EPOCH FROM i.resolved_at) * 1000 AS to_ms,
             COALESCE((SELECT array_agg(DISTINCT r.services_id) FROM incidents_rels r
                        WHERE r.parent_id = i.id AND r.path = 'affectedServices' AND r.services_id IS NOT NULL), '{}') AS service_ids,
             COALESCE((SELECT array_agg(u.message ORDER BY u._order) FROM incidents_updates u
                        WHERE u._parent_id = i.id), '{}') AS messages
        FROM incidents i`)
  ).rows as Array<{
    id: number
    title: string
    availability_class: string | null
    from_ms: number | string
    to_ms: number | string | null
    service_ids: number[]
    messages: string[]
  }>

  const reconstructedBefore = Number(
    ((await db.execute(sql`SELECT COUNT(*) AS n FROM service_status_events WHERE source = 'reconstructed'`)).rows[0] as { n: number | string }).n,
  )

  const counts: Record<string, number> = {}
  const incidents: Parameters<typeof buildReconstructedEvents>[0]['incidents'] = []
  for (const row of incidentRows) {
    const result = classifyIncident({ title: row.title, messages: row.messages, availabilityClass: row.availability_class })
    const key = result.status === 'partial' && !result.sure ? 'partial (nicht eindeutig)' : result.status
    counts[key] = (counts[key] ?? 0) + 1
    if (result.status === 'none') continue
    incidents.push({ serviceIds: row.service_ids, from: Number(row.from_ms), to: row.to_ms === null ? null : Number(row.to_ms), status: result.status })
  }
  const summary = summarizeClassification(
    incidentRows.map((row) => ({
      title: row.title,
      messages: row.messages,
      serviceCount: row.service_ids.length,
      availabilityClass: row.availability_class,
    })),
  )

  let events: ReturnType<typeof buildReconstructedEvents> = []
  if (incidentRows.length > 0) {
    const serviceRows = (
      await db.execute(sql`
        SELECT s.id,
               (SELECT EXTRACT(EPOCH FROM MIN(e.changed_at)) * 1000 FROM service_status_events e
                 WHERE e.service_id = s.id AND e.source = 'operation') AS first_ms
          FROM services s`)
    ).rows as Array<{ id: number; first_ms: number | string | null }>
    events = buildReconstructedEvents({
      anchorAt: Math.min(...incidentRows.map((row) => Number(row.from_ms))),
      services: serviceRows.map((row) => ({ id: row.id, firstEventAt: row.first_ms === null ? null : Number(row.first_ms) })),
      incidents,
    })
  }

  if (!options.dryRun) {
    const write = async (runner: SqlRunner) => {
      await runner.execute(sql`DELETE FROM service_status_events WHERE source = 'reconstructed'`)
      for (let offset = 0; offset < events.length; offset += INSERT_BATCH) {
        const values = events
          .slice(offset, offset + INSERT_BATCH)
          .map((event) => sql`(${event.serviceId}, ${event.status}::enum_service_status_events_status, to_timestamp(${event.at} / 1000.0), 'reconstructed')`)
        await runner.execute(sql`
          INSERT INTO service_status_events (service_id, status, changed_at, source)
          VALUES ${sql.join(values, sql`, `)}`)
      }
    }
    if (db.transaction) await db.transaction(write)
    else await write(db)
  }

  return {
    dryRun: options.dryRun,
    incidents: incidentRows.length,
    counts,
    reconstructedBefore,
    reconstructedAfter: events.length,
    unsure: summary.unsure,
    withoutService: summary.withoutService,
  }
}
