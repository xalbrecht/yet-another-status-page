import type { Payload } from 'payload'
import { rebuildStatusLog, type RebuildResult, type SqlRunner } from '@/lib/status-log-rebuild'

/**
 * Wandelt Störungen aus dem Vorgängerverfahren, die in Wahrheit Wartungen waren (Titel enthält „Wartung“), in
 * Wartungen um (Konzept 4.8, Issue #57). Offene Vorfälle und Vorfälle mit Einordnung von Hand bleiben unberührt.
 */
export type MaintenanceDraft = {
  title: string
  description: string
  affectedServices: Array<number | string>
  scheduledStartAt: string
  scheduledEndAt: string
  completedAt: string
  status: 'completed'
  updates: Array<{ status: 'in_progress' | 'completed'; message: string; createdAt: string }>
}

export type IncidentForConversion = {
  id: number | string
  title: string
  shortId: string | null
  createdAt: string
  resolvedAt: string | null
  availabilityClass?: string | null
  serviceIds: Array<number | string>
  updates: Array<{ status: string; message: string; createdAt: string }>
}

export type ConversionPlan = { skip: 'open' | 'manual' | 'not-maintenance' | 'after-start' } | { maintenance: MaintenanceDraft }

/**
 * `cutoffAt`: Zeitpunkt des ersten Betriebseintrags im Statusprotokoll. Vorfälle, die danach in YASP erfasst wurden,
 * sind keine übernommenen und werden nicht umgewandelt.
 */
export function planMaintenanceFromIncident(
  incident: IncidentForConversion,
  options: { cutoffAt?: string | null } = {},
): ConversionPlan {
  if (!incident.title.toLowerCase().includes('wartung')) return { skip: 'not-maintenance' }
  if (incident.availabilityClass && incident.availabilityClass !== 'auto') return { skip: 'manual' }
  if (options.cutoffAt && new Date(incident.createdAt).getTime() >= new Date(options.cutoffAt).getTime()) return { skip: 'after-start' }
  if (!incident.resolvedAt) return { skip: 'open' }
  return {
    maintenance: {
      title: incident.title,
      description: incident.shortId
        ? `Übernommen aus Störung ${incident.shortId} (Vorgängerverfahren)`
        : 'Übernommen aus einer Störung des Vorgängerverfahrens',
      affectedServices: incident.serviceIds,
      scheduledStartAt: incident.createdAt,
      scheduledEndAt: incident.resolvedAt,
      completedAt: incident.resolvedAt,
      status: 'completed',
      updates: incident.updates.map((update) => ({
        status: update.status === 'resolved' ? 'completed' : 'in_progress',
        message: update.message,
        createdAt: update.createdAt,
      })),
    },
  }
}

export type ConversionResult = {
  dryRun: boolean
  converted: Array<{ incidentId: string; title: string; services: number; from: string; to: string }>
  skipped: Array<{ incidentId: string; title: string; reason: string }>
  rebuild?: RebuildResult
  /** Fehlertext, wenn die Nachrechnung nach der Umwandlung scheiterte. Die Umwandlung selbst ist dann abgeschlossen. */
  rebuildError?: string
}

/** Die Beschreibung einer Wartung ist ein Lexical-Dokument. Ein Absatz mit dem Text genügt. */
function descriptionToLexical(text: string) {
  return {
    root: {
      type: 'root',
      format: '' as const,
      indent: 0,
      version: 1,
      direction: 'ltr' as const,
      children: [
        {
          type: 'paragraph',
          format: '',
          indent: 0,
          version: 1,
          direction: 'ltr',
          children: [{ type: 'text', text, detail: 0, format: 0, mode: 'normal', style: '', version: 1 }],
        },
      ],
    },
  }
}

const idOf = (value: unknown): number | string =>
  typeof value === 'object' && value !== null ? (value as { id: number | string }).id : (value as number | string)

/** Vorschau oder Umwandlung. Bei `dryRun: false`: Wartung anlegen, Vorfall löschen, danach das Protokoll neu nachrechnen. */
export async function convertMaintenanceIncidents(payload: Payload, options: { dryRun: boolean }): Promise<ConversionResult> {
  const incidents = await payload.find({ collection: 'incidents', depth: 0, pagination: false, sort: 'createdAt' })
  const result: ConversionResult = { dryRun: options.dryRun, converted: [], skipped: [] }
  const context = { skipNotificationCreation: true, skipAutoStatusUpdate: true, skipServiceSync: true }
  const firstOperation = await payload.find({
    collection: 'service-status-events',
    where: { source: { equals: 'operation' } },
    sort: 'changedAt',
    limit: 1,
    depth: 0,
  })
  const cutoffAt = firstOperation.docs[0]?.changedAt ?? null

  for (const doc of incidents.docs) {
    const plan = planMaintenanceFromIncident({
      id: doc.id,
      title: doc.title,
      shortId: doc.shortId ?? null,
      createdAt: doc.createdAt,
      resolvedAt: doc.resolvedAt ?? null,
      availabilityClass: doc.availabilityClass,
      serviceIds: (doc.affectedServices || []).map(idOf),
      updates: (doc.updates || []).map((update) => ({ status: update.status, message: update.message, createdAt: update.createdAt })),
    }, { cutoffAt })
    const incidentId = String(doc.id)
    if ('skip' in plan) {
      if (plan.skip !== 'not-maintenance') result.skipped.push({ incidentId, title: doc.title, reason: plan.skip })
      continue
    }
    const draft = plan.maintenance
    const entry = { incidentId, title: draft.title, services: draft.affectedServices.length, from: draft.scheduledStartAt, to: draft.scheduledEndAt }
    if (options.dryRun) {
      result.converted.push(entry)
      continue
    }
    try {
      // Nach einem abgebrochenen Lauf besteht die Wartung schon, der Vorfall noch nicht gelöscht: nicht doppelt anlegen
      const existing = await payload.find({
        collection: 'maintenances',
        where: { and: [{ title: { equals: draft.title } }, { scheduledStartAt: { equals: draft.scheduledStartAt } }] },
        limit: 1,
        depth: 0,
      })
      if (existing.docs.length === 0) {
        await payload.create({
          collection: 'maintenances',
          data: { ...draft, description: descriptionToLexical(draft.description), affectedServices: draft.affectedServices.map(Number) },
          depth: 0,
          context,
        })
      }
      await payload.delete({ collection: 'incidents', id: doc.id, depth: 0, context })
      result.converted.push(entry)
    } catch (error) {
      result.skipped.push({ incidentId, title: doc.title, reason: `error: ${error instanceof Error ? error.message : String(error)}` })
    }
  }

  if (!options.dryRun) {
    const db = (payload.db as unknown as { drizzle: SqlRunner }).drizzle
    try {
      result.rebuild = await rebuildStatusLog(db, { dryRun: false })
    } catch (error) {
      result.rebuildError = error instanceof Error ? error.message : String(error)
    }
  }
  return result
}
