/**
 * Feld „Betroffene Dienste“ der Störungen und Wartungen: Angeboten und angenommen werden nur Dienste, die jetzt aktiv sind
 * (Beginn erreicht, Ende leer oder nicht überschritten, siehe `service-lifecycle.ts`).
 * Bereits gespeicherte Verknüpfungen bleiben erhalten: Sie bleiben in der Auswahl und lassen sich beim Ändern der Störung
 * oder Wartung weiter speichern, auch wenn der Dienst inzwischen beendet ist.
 */
import type { FilterOptions, Validate, Where } from 'payload'
import { allowRequest, groupIdsOfServices } from '@/lib/access'
import { ta } from '@/lib/i18n/admin'
import { groupScope, hasRole, scopeAllows, type RoleUser, type ScopedRole } from '@/lib/roles'
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
const activeOrChosen = (data: unknown): Where => {
  const current = relationIds((data as Record<string, unknown> | undefined)?.affectedServices)
  const active = activeServiceWhereNow()
  return current.length ? { or: [active, { id: { in: current } }] } : active
}

export const activeServicesFilterOptions: FilterOptions = ({ data }) => activeOrChosen(data)

/**
 * Auswahl im Formular wie `activeServicesFilterOptions`, für ServiceDesk und Produktmanager zusätzlich nur Dienste
 * ihrer Dienstgruppen. Admins und der Bereich „alle“ sehen alle aktiven Dienste.
 */
export const affectedServicesFilterOptions =
  (roles: readonly ScopedRole[]): FilterOptions =>
  ({ data, req }) => {
    const base = activeOrChosen(data)
    const user = req?.user as RoleUser
    if (!user || hasRole(user, 'admin')) return base
    const scope = groupScope(user, roles)
    if (scope === 'all') return base
    return { and: [base, { group: { in: scope.length ? scope : [0] } }] }
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

/**
 * Prüfung beim Speichern (auch über die Schnittstelle): ServiceDesk und Produktmanager mit Gruppenliste wählen nur Dienste
 * ihrer Gruppen, mindestens einen. Admins, der Bereich „alle“, den Testmodus ohne Anmeldung und das System (lokale API
 * ohne Benutzer) betrifft die Prüfung nicht. Der gespeicherte Stand wird in `groupScopedWrite` geprüft.
 */
export function validateGroupScope(roles: readonly ScopedRole[]): Validate {
  return async (value, { req }) => {
    const user = req.user as RoleUser
    if (!user || allowRequest(user) || hasRole(user, 'admin')) return true
    if (req.context?.skipServiceSync) return true
    if (groupScope(user, roles) === 'all') return true
    const groups = await groupIdsOfServices(req.payload, relationIds(value), req)
    return scopeAllows(user, roles, groups ?? [], 'all') ? true : ta('Only services of your own service groups can be chosen, at least one')
  }
}

/** Beide Prüfungen des Felds „Betroffene Dienste“ in einer Funktion. */
export function validateAffectedServices(collection: 'incidents' | 'maintenances', roles: readonly ScopedRole[]): Validate {
  const active = validateActiveServices(collection)
  const scoped = validateGroupScope(roles)
  return async (value, options) => {
    const result = await active(value, options)
    return result === true ? scoped(value, options) : result
  }
}
