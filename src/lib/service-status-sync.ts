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

/**
 * Setzt den Zustand der Dienste aus den offenen Störungen:
 * - Offene Störung vorhanden: schlechteste „Auswirkung“ aller offenen Störungen gilt.
 * - Keine offene Störung: Zustand „Betriebsbereit“. Ein Dienst in „Wartung“ bleibt in Wartung.
 * Änderungen laufen über die Collection „Dienste“ und landen so im Statusprotokoll.
 */
export async function syncServiceStatusesFromIncidents(
  payload: Payload,
  serviceIds: Array<number | string>,
  req?: Partial<PayloadRequest>,
): Promise<void> {
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
    const target: ServiceStatus = worst ?? (service.status === 'maintenance' ? 'maintenance' : 'operational')

    if (service.status !== target) {
      await payload.update({ collection: 'services', id, data: { status: target }, depth: 0, req })
    }
  }
}
