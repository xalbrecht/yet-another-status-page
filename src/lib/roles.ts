/**
 * Rollen und Dienstgruppen-Bereiche der Benutzer. Reine Funktionen ohne Payload, damit sich die Regeln als Tabelle testen lassen.
 *
 * Regeln:
 * - Ein Benutzer ohne Rolle hat nirgends Zugriff.
 * - Admin hat keine Beschränkung.
 * - ServiceDesk und Produktmanager haben je Rolle den Haken „alle Dienstgruppen“ oder eine Liste von Dienstgruppen.
 *   Ohne Haken und ohne Gruppe bleibt der Bereich leer: kein Zugriff.
 */

export const ROLES = ['admin', 'servicedesk', 'produktmanager'] as const
export type Role = (typeof ROLES)[number]

/** Rollen mit Gruppenbeschränkung. */
export type ScopedRole = 'servicedesk' | 'produktmanager'

type GroupRef = number | { id: number }

export type RoleUser =
  | {
      roles?: Role[] | null
      servicedeskAlleGruppen?: boolean | null
      servicedeskGruppen?: GroupRef[] | null
      produktmanagerAlleGruppen?: boolean | null
      produktmanagerGruppen?: GroupRef[] | null
    }
  | null
  | undefined

/** Bereich der erlaubten Dienstgruppen: alle oder eine Liste (leer = keine Gruppe). */
export type GroupScope = 'all' | number[]

export function hasRole(user: RoleUser, role: Role): boolean {
  return Array.isArray(user?.roles) && user.roles.includes(role)
}

export function hasAnyRole(user: RoleUser, roles: readonly Role[]): boolean {
  return roles.some((role) => hasRole(user, role))
}

const idOf = (ref: GroupRef): number => Number(typeof ref === 'object' ? ref.id : ref)

/** Bereich einer einzelnen Rolle, ohne Prüfung auf Admin. */
function scopeOfRole(user: RoleUser, role: ScopedRole): GroupScope {
  if (!user || !hasRole(user, role)) return []
  const all = role === 'servicedesk' ? user.servicedeskAlleGruppen : user.produktmanagerAlleGruppen
  if (all) return 'all'
  const groups = role === 'servicedesk' ? user.servicedeskGruppen : user.produktmanagerGruppen
  return (groups ?? []).map(idOf)
}

/** Vereinigung der Bereiche der genannten Rollen. Admin ergibt „alle“. */
export function groupScope(user: RoleUser, roles: readonly ScopedRole[]): GroupScope {
  if (hasRole(user, 'admin')) return 'all'
  const ids = new Set<number>()
  for (const role of roles) {
    const scope = scopeOfRole(user, role)
    if (scope === 'all') return 'all'
    for (const id of scope) ids.add(id)
  }
  return [...ids]
}

/**
 * Darf der Benutzer ein Objekt bearbeiten, das zu den Dienstgruppen `groupIds` gehört?
 * `any`: mindestens eine Gruppe im Bereich (Lesen). `all`: jede Gruppe im Bereich (Schreiben).
 * Ohne Gruppen am Objekt darf mit Gruppenliste nur Admin. Der Bereich „alle“ (Haken „alle Dienstgruppen“) gilt auch dafür.
 */
export function scopeAllows(user: RoleUser, roles: readonly ScopedRole[], groupIds: number[], mode: 'any' | 'all'): boolean {
  if (hasRole(user, 'admin')) return true
  const scope = groupScope(user, roles)
  if (scope === 'all') return true
  if (groupIds.length === 0 || scope.length === 0) return false
  return mode === 'any' ? groupIds.some((id) => scope.includes(id)) : groupIds.every((id) => scope.includes(id))
}
