import type { Payload } from 'payload'
import { classifyIncident, type ClassificationRule } from '@/lib/incident-classification'
import { rebuildStatusLog, type RebuildResult, type SqlRunner } from '@/lib/status-log-rebuild'
import { assertPreviewMatches, fingerprintOf, type PreviewCheck } from '@/lib/preview-check'

/**
 * Wandelt Störungen aus der Zeit vor dem Statusprotokoll, die in Wahrheit Wartungen waren, in Wartungen um. Welche
 * das sind, entscheiden die Regeln der Einstellungen (Einordnung „Wartung“). Offene Vorfälle und Vorfälle mit
 * Einordnung von Hand bleiben unberührt.
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
  options: { cutoffAt?: string | null; rules?: readonly ClassificationRule[] } = {},
): ConversionPlan {
  // Die Regeln ohne Einordnung von Hand auswerten: eine Einordnung von Hand wird unten eigens gemeldet
  const byRules = classifyIncident({ title: incident.title, messages: incident.updates.map((update) => update.message) }, options.rules)
  if (byRules.status !== 'maintenance') return { skip: 'not-maintenance' }
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
  /** Zahl und Hash der Menge, auf die sich die Vorschau bezieht. Die Oberfläche schickt sie beim Ausführen zurück (Prüfung in `assertPreviewMatches`). */
  check: PreviewCheck
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

/**
 * Vorschau oder Umwandlung. Bei `dryRun: false`: Wartung anlegen, Vorfall löschen, danach das Protokoll neu nachrechnen.
 * Mit `expect` (Ergebnis der Vorschau) wird vorher geprüft, ob dieselben Vorfälle umgewandelt würden. Sonst wird nichts geändert.
 */
export async function convertMaintenanceIncidents(
  payload: Payload,
  options: { dryRun: boolean; rules?: readonly ClassificationRule[]; expect?: PreviewCheck },
): Promise<ConversionResult> {
  const incidents = await payload.find({ collection: 'incidents', depth: 0, pagination: false, sort: 'createdAt' })
  const context = { skipNotificationCreation: true, skipAutoStatusUpdate: true, skipServiceSync: true }
  const firstOperation = await payload.find({
    collection: 'service-status-events',
    where: { source: { equals: 'operation' } },
    sort: 'changedAt',
    limit: 1,
    depth: 0,
  })
  const cutoffAt = firstOperation.docs[0]?.changedAt ?? null

  // Erst planen, dann ändern: Die Vorschau ist genau diese Planung. Sie liefert die Zahl und den Hash für „Ausführen“.
  const planned: Array<{ doc: (typeof incidents.docs)[number]; draft: MaintenanceDraft; entry: ConversionResult['converted'][number] }> = []
  const skipped: ConversionResult['skipped'] = []
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
    }, { cutoffAt, rules: options.rules })
    const incidentId = String(doc.id)
    if ('skip' in plan) {
      if (plan.skip !== 'not-maintenance') skipped.push({ incidentId, title: doc.title, reason: plan.skip })
      continue
    }
    const draft = plan.maintenance
    planned.push({ doc, draft, entry: { incidentId, title: draft.title, services: draft.affectedServices.length, from: draft.scheduledStartAt, to: draft.scheduledEndAt } })
  }

  const byId = (a: { incidentId: string }, b: { incidentId: string }) => a.incidentId.localeCompare(b.incidentId)
  const check: PreviewCheck = {
    count: planned.length,
    fingerprint: fingerprintOf({ converted: planned.map((item) => item.entry).sort(byId), skipped: [...skipped].sort(byId) }),
  }
  const result: ConversionResult = { dryRun: options.dryRun, converted: [], skipped, check }

  if (options.dryRun) {
    result.converted = planned.map((item) => item.entry)
    return result
  }

  // Vor der ersten Änderung: weicht die Menge von der Vorschau ab, wird nichts angelegt und nichts gelöscht
  assertPreviewMatches(options.expect, check)

  for (const { doc, draft, entry } of planned) {
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
      result.skipped.push({ incidentId: entry.incidentId, title: doc.title, reason: `error: ${error instanceof Error ? error.message : String(error)}` })
    }
  }

  const db = (payload.db as unknown as { drizzle: SqlRunner }).drizzle
  try {
    result.rebuild = await rebuildStatusLog(db, { dryRun: false, rules: options.rules })
  } catch (error) {
    result.rebuildError = error instanceof Error ? error.message : String(error)
  }
  return result
}
