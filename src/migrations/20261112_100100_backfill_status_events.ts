import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'
import { classifyIncident } from '../lib/incident-classification'
import { buildReconstructedEvents } from '../lib/status-reconstruction'

/**
 * Rechnet das Statusprotokoll vor dem 10.11.2026 aus den Vorfällen nach (Konzept 5).
 * Wiederholbar: zuerst werden alle Zeilen mit source = 'reconstructed' gelöscht. Die Zeilen mit source = 'operation'
 * (auch die Startwerte vom 10.11.2026) bleiben unverändert. Das Feld `impact` der Vorfälle wird nicht gelesen.
 */
export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  // Auch offene Vorfälle: sie gelten ab Beginn bis zum ersten Betriebseintrag des Dienstes (danach gilt der echte Zustand)
  const incidentRows = (
    await db.execute(sql`
      SELECT i.id,
             i.title,
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
    from_ms: number | string
    to_ms: number | string | null
    service_ids: number[]
    messages: string[]
  }>

  await db.execute(sql`DELETE FROM service_status_events WHERE source = 'reconstructed'`)
  if (incidentRows.length === 0) return

  const counts: Record<string, number> = {}
  const incidents: Parameters<typeof buildReconstructedEvents>[0]['incidents'] = []
  for (const row of incidentRows) {
    const result = classifyIncident({ title: row.title, messages: row.messages })
    const key = result.status === 'partial' && !result.sure ? 'partial (nicht eindeutig)' : result.status
    counts[key] = (counts[key] ?? 0) + 1
    if (result.status === 'none') continue
    incidents.push({ serviceIds: row.service_ids, from: Number(row.from_ms), to: row.to_ms === null ? null : Number(row.to_ms), status: result.status })
  }
  const anchorAt = Math.min(...incidentRows.map((row) => Number(row.from_ms)))

  const serviceRows = (
    await db.execute(sql`
      SELECT s.id,
             (SELECT EXTRACT(EPOCH FROM MIN(e.changed_at)) * 1000 FROM service_status_events e
               WHERE e.service_id = s.id AND e.source = 'operation') AS first_ms
        FROM services s`)
  ).rows as Array<{ id: number; first_ms: number | string | null }>

  const events = buildReconstructedEvents({
    anchorAt,
    services: serviceRows.map((row) => ({ id: row.id, firstEventAt: row.first_ms === null ? null : Number(row.first_ms) })),
    incidents,
  })
  for (const event of events) {
    await db.execute(sql`
      INSERT INTO service_status_events (service_id, status, changed_at, source)
      VALUES (${event.serviceId}, ${event.status}::enum_service_status_events_status, to_timestamp(${event.at} / 1000.0), 'reconstructed')`)
  }
  payload.logger.info(
    `Nachrechnung: ${events.length} Einträge für ${serviceRows.length} Dienste, Einordnung der ${incidentRows.length} Vorfälle: ${JSON.stringify(counts)}`,
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DELETE FROM service_status_events WHERE source = 'reconstructed'`)
}
