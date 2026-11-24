import type { Access, FieldAccess, Payload, PayloadRequest } from 'payload'
import { groupScope, hasAnyRole, hasRole, scopeAllows, type Role, type RoleUser, type ScopedRole } from '@/lib/roles'

/**
 * Access control helpers
 * 
 * These functions provide consistent access control across collections.
 * In E2E test mode (PAYLOAD_PUBLIC_ALLOW_WRITES=true), write operations
 * are allowed without authentication to facilitate testing.
 */

export const isTestMode = (): boolean => {
  return process.env.PAYLOAD_PUBLIC_ALLOW_WRITES === 'true'
}

/**
 * Im Testmodus sind anonyme Anfragen erlaubt. Angemeldete Benutzer unterliegen auch dort den Rollen,
 * sonst lassen sich Rollen nicht prüfen.
 */
export const allowRequest = (user: unknown): boolean => isTestMode() && !user

/**
 * Allows read access to everyone
 */
export const publicRead: Access = () => true

/** Rollen, die Gruppenbereiche haben (Admin gilt immer für alle Gruppen). */
type ScopedRoles = readonly ScopedRole[]

/** Angemeldet mit einer der Rollen. Im Testmodus sind anonyme Anfragen erlaubt. */
export const rolesAccess =
  (roles: readonly Role[]): Access =>
  ({ req: { user } }) =>
    allowRequest(user) || hasAnyRole(user as RoleUser, roles)

/** Feldrecht mit denselben Regeln wie `rolesAccess`. */
export const rolesFieldAccess =
  (roles: readonly Role[]): FieldAccess =>
  ({ req: { user } }) =>
    allowRequest(user) || hasAnyRole(user as RoleUser, roles)

/** Kennungen der betroffenen Dienste eines gespeicherten Dokuments. */
const serviceIdsOf = (doc: unknown): string[] => {
  const list = (doc as { affectedServices?: unknown } | null)?.affectedServices
  if (!Array.isArray(list)) return []
  return list.map((item) => String(item && typeof item === 'object' ? (item as { id: unknown }).id : item))
}

/**
 * Lesen von Störungen und Wartungen: Ohne Anmeldung und ohne Rolle wie bisher öffentlich. Mit Rolle ServiceDesk oder
 * Produktmanager nur Meldungen, bei denen mindestens ein betroffener Dienst in einer erlaubten Gruppe liegt.
 */
export const groupScopedRead =
  (roles: ScopedRoles): Access =>
  ({ req: { user } }) => {
    const u = user as RoleUser
    if (!user || hasRole(u, 'admin')) return true
    if (!hasAnyRole(u, roles)) return true
    const scope = groupScope(u, roles)
    if (scope === 'all') return true
    if (scope.length === 0) return false
    return { 'affectedServices.group': { in: scope } }
  }

/**
 * Ändern und Löschen von Störungen und Wartungen: nur wenn alle betroffenen Dienste des gespeicherten Stands in erlaubten
 * Gruppen liegen. Eine Sammelaktion ohne Kennung ist nur Admins und dem Bereich „alle“ erlaubt. Der neue Stand wird beim
 * Speichern in `validateGroupScope` geprüft.
 */
export const groupScopedWrite =
  (collection: 'incidents' | 'maintenances', roles: ScopedRoles): Access =>
  async ({ req, id }) => {
    const { user, payload } = req
    if (allowRequest(user)) return true
    const u = user as RoleUser
    if (hasRole(u, 'admin')) return true
    if (!hasAnyRole(u, roles)) return false
    const scope = groupScope(u, roles)
    if (scope === 'all') return true
    if (id === undefined || id === null || scope.length === 0) return false
    const doc = await payload.findByID({ collection, id, depth: 0, overrideAccess: true, disableErrors: true, req })
    if (!doc) return false
    const groups = await groupIdsOfServices(payload, serviceIdsOf(doc), req)
    return scopeAllows(u, roles, groups ?? [], 'all')
  }

/** Statusprotokoll: Admin und Produktmanager, der Produktmanager nur für Dienste seiner Gruppen. */
export const statusEventsRead: Access = ({ req: { user } }) => {
  if (allowRequest(user)) return true
  const u = user as RoleUser
  if (hasRole(u, 'admin')) return true
  if (!hasRole(u, 'produktmanager')) return false
  const scope = groupScope(u, ['produktmanager'])
  if (scope === 'all') return true
  if (scope.length === 0) return false
  return { 'service.group': { in: scope } }
}

/** Nur Admins. Ein Testmodus ohne Anmeldung gilt hier nicht: Benutzer und Rollen ändern sich nie anonym. */
export const adminOnly: Access = ({ req: { user } }) => hasRole(user as RoleUser, 'admin')

/** Feldrecht: nur Admins lesen oder ändern das Feld, etwa die Rollen eines Benutzers. */
export const adminOnlyField: FieldAccess = ({ req: { user } }) => hasRole(user as RoleUser, 'admin')

/** Admins sehen und ändern alle Datensätze, andere Angemeldete nur den eigenen. */
export const adminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false
  if (hasRole(user as RoleUser, 'admin')) return true
  return { id: { equals: user.id } }
}

/**
 * Dienstgruppen der Dienste mit den Kennungen `serviceIds`, ohne Doppelte. `null`, wenn ein Dienst fehlt oder keine
 * Gruppe hat: Dann darf nur ein Admin handeln (siehe `scopeAllows`).
 */
export async function groupIdsOfServices(payload: Payload, serviceIds: string[], req?: PayloadRequest): Promise<number[] | null> {
  const ids = [...new Set(serviceIds)]
  if (ids.length === 0) return []
  const found = await payload.find({ collection: 'services', where: { id: { in: ids } }, depth: 0, pagination: false, overrideAccess: true, req })
  if (found.docs.length < ids.length) return null
  const groups = new Set<number>()
  for (const service of found.docs) {
    const group = (service as { group?: number | { id: number } | null }).group
    if (group === null || group === undefined) return null
    groups.add(Number(typeof group === 'object' ? group.id : group))
  }
  return [...groups]
}
