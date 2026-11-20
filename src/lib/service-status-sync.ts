import type { Payload, PayloadRequest } from 'payload'
import type { Service } from '@/payload-types'

type ServiceStatus = Service['status']

/** Reihenfolge der Auswirkungen, schlechtester Zustand zuerst. */
const impactOrder: ServiceStatus[] = ['major', 'partial', 'degraded']

const toId = (value: unknown): number | string | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'object') return (value as { id: number | string }).id ?? null
  return value as number | string
}

/** Wandelt eine Liste aus IDs oder Objekten in eine Liste eindeutiger IDs. */
export function uniqueServiceIds(...lists: Array<unknown[] | null | undefined>): Array<number | string> {
  const ids = new Set<number | string>()
  for (const list of lists) {
    for (const entry of list || []) {
      const id = toId(entry)
      if (id !== null) ids.add(id)
    }
  }
  return Array.from(ids)
}

/** Zustände, die ein Dienst sich merken kann: „Wartung“ nie (die Wartung kann beim Ende des Vorfalls vorbei sein). */
export type RememberableStatus = Exclude<ServiceStatus, 'maintenance'>

/** Eine Zeile des Feldes `serviceChoices` am Vorfall: Soll der Dienst in den Zustand vor dem Vorfall zurückkehren? */
export type ServiceChoice = { service: unknown; restore?: boolean | null }

export type SyncContext = {
  /** Vorfall, der gerade gespeichert oder gelöscht wurde. */
  incidentId?: number | string
  /** Dienste, die dieser Vorfall vor der Änderung als offener Vorfall hielt (leer bei neuem oder wieder geöffnetem Vorfall). */
  previouslyOpenServiceIds?: Array<number | string>
  /** `serviceChoices` des gerade gespeicherten Vorfalls. Fehlt beim Löschen und in Aufrufen ohne das Feld. */
  choices?: ServiceChoice[] | null
}

/**
 * Entscheidet Zielzustand und Merkfeld eines Dienstes.
 * - Vorfall offen: schlechteste Auswirkung gilt. Der Zustand davor wird gemerkt, wenn der Dienst nicht „Betriebsbereit“ oder
 *   „Wartung“ ist, noch nichts gemerkt ist, kein anderer offener Vorfall den Dienst erfasst und der Vorfall den Dienst nicht
 *   schon vor der Änderung hielt (Vorfälle aus der Zeit vor dem Merkfeld nicht nachmerken).
 * - Kein Vorfall offen: Rückkehr in den gemerkten Zustand, wenn gewählt, sonst „Betriebsbereit“ (ein Dienst in „Wartung“
 *   bleibt in Wartung). Das Merkfeld wird geleert.
 */
export function decideServiceState(input: {
  current: ServiceStatus
  remembered: RememberableStatus | null | undefined
  worstOpenImpact: ServiceStatus | undefined
  otherOpenIncidentsCoverService: boolean
  wasCoveredBefore: boolean
  restore: boolean
}): { target: ServiceStatus; remember: RememberableStatus | null } {
  const { current, remembered, worstOpenImpact } = input
  if (worstOpenImpact) {
    const mayRemember =
      !remembered &&
      !input.otherOpenIncidentsCoverService &&
      !input.wasCoveredBefore &&
      current !== 'operational' &&
      current !== 'maintenance'
    return { target: worstOpenImpact, remember: mayRemember ? current : (remembered ?? null) }
  }
  // „Wartung“ bleibt Wartung, auch wenn die Rückkehr gewählt ist (der Dienst wurde während des Vorfalls auf Wartung gesetzt)
  if (current === 'maintenance') return { target: 'maintenance', remember: null }
  if (input.restore && remembered) return { target: remembered, remember: null }
  return { target: 'operational', remember: null }
}

/**
 * Setzt den Zustand der Dienste aus den offenen Störungen:
 * - Offene Störung vorhanden: schlechteste „Auswirkung“ aller offenen Störungen gilt. Der Zustand davor wird gemerkt.
 * - Keine offene Störung: „Betriebsbereit“, oder auf Wunsch (`context.choices`, Haken je Dienst) der gemerkte Zustand.
 *   Ein Dienst in „Wartung“ bleibt in Wartung.
 * Änderungen laufen über die Collection „Dienste“ und landen so im Statusprotokoll.
 */
export async function syncServiceStatusesFromIncidents(
  payload: Payload,
  serviceIds: Array<number | string>,
  req?: Partial<PayloadRequest>,
  context: SyncContext = {},
): Promise<void> {
  const previouslyOpen = new Set((context.previouslyOpenServiceIds ?? []).map(String))
  const restoreIds = new Set(
    (context.choices ?? []).filter((choice) => choice.restore === true).map((choice) => String(toId(choice.service))),
  )

  for (const id of serviceIds) {
    const service = await payload.findByID({ collection: 'services', id, depth: 0, req, disableErrors: true })
    if (!service) continue

    const open = await payload.find({
      collection: 'incidents',
      where: { and: [{ affectedServices: { contains: id } }, { status: { not_equals: 'resolved' } }] },
      depth: 0,
      pagination: false,
      req,
    })

    const worst = impactOrder.find((status) => open.docs.some((incident) => (incident.impact || 'degraded') === status))
    const { target, remember } = decideServiceState({
      current: service.status,
      remembered: service.statusBeforeIncident,
      worstOpenImpact: worst,
      otherOpenIncidentsCoverService: open.docs.some((incident) => String(incident.id) !== String(context.incidentId)),
      wasCoveredBefore: previouslyOpen.has(String(id)),
      restore: restoreIds.has(String(id)),
    })

    if (service.status !== target || (service.statusBeforeIncident ?? null) !== remember) {
      await payload.update({ collection: 'services', id, data: { status: target, statusBeforeIncident: remember }, depth: 0, req })
    }
  }
}
