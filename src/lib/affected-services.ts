/**
 * Feld „Betroffene Dienste“ der Störungen und Wartungen: Angeboten und angenommen werden nur Dienste, die jetzt aktiv sind
 * (Beginn erreicht, Ende leer oder nicht überschritten, siehe `service-lifecycle.ts`).
 * Bereits gespeicherte Verknüpfungen bleiben erhalten: Sie bleiben in der Auswahl und lassen sich beim Ändern der Störung
 * oder Wartung weiter speichern, auch wenn der Dienst inzwischen beendet ist.
 */
import type { FilterOptions, Validate } from 'payload'
import { ta } from '@/lib/i18n/admin'
import { activeServiceWhereNow } from '@/lib/service-lifecycle'

type IdLike = number | string | { id: number | string } | null | undefined

/** Kennungen aus einer Liste von Verknüpfungen (Kennung oder aufgelöstes Objekt). */
export function relationIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return (value as IdLike[])
    .map((item) => (item && typeof item === 'object' ? item.id : item))
    .filter((id): id is number | string => id !== null && id !== undefined)
    .map(String)
}

/** Neu hinzugekommene Kennungen: im neuen Stand, nicht im gespeicherten. */
export function addedIds(next: string[], stored: string[]): string[] {
  const known = new Set(stored)
  return next.filter((id) => !known.has(id))
}

/** Auswahl im Formular: aktive Dienste und die bereits gewählten. */
export const activeServicesFilterOptions: FilterOptions = ({ data }) => {
  const current = relationIds((data as Record<string, unknown> | undefined)?.affectedServices)
  const active = activeServiceWhereNow()
  return current.length ? { or: [active, { id: { in: current } }] } : active
}

/** Prüfung beim Speichern (auch über die Schnittstelle): neu hinzugekommene Dienste müssen aktiv sein. */
export function validateActiveServices(collection: 'incidents' | 'maintenances'): Validate {
  return async (value, { req, id, operation }) => {
    // Umwandlung von Störungen in Wartungen übernimmt die Dienste unverändert
    if (req.context?.skipServiceSync) return true
    const ids = relationIds(value)
    if (ids.length === 0) return true

    let stored: string[] = []
    if (operation === 'update' && id !== undefined) {
      const existing = await req.payload.findByID({ collection, id, depth: 0, req, disableErrors: true })
      stored = relationIds((existing as { affectedServices?: unknown } | null)?.affectedServices)
    }
    const added = addedIds(ids, stored)
    if (added.length === 0) return true

    const active = await req.payload.find({
      collection: 'services',
      where: { and: [{ id: { in: added } }, activeServiceWhereNow()] },
      depth: 0,
      pagination: false,
      req,
    })
    const activeIds = new Set(active.docs.map((doc) => String(doc.id)))
    return added.every((serviceId) => activeIds.has(serviceId))
      ? true
      : ta('Only services that are active today can be affected. Services that have ended or not yet started cannot be chosen')
  }
}
