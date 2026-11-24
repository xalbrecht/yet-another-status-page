import type { Payload, TypedUser } from 'payload'
import { allowRequest } from '@/lib/access'
import { ta } from '@/lib/i18n/admin'
import { hasAnyRole, type Role, type RoleUser } from '@/lib/roles'

export type RouteAuth =
  | { ok: true; user: TypedUser | null }
  | { ok: false; status: 401 | 403; message: string }

/**
 * Prüft die Anmeldung und die Rolle einer eigenen API-Route. Ohne Anmeldung ergibt es 401, mit Anmeldung aber ohne eine
 * der Rollen 403. Im Testmodus (`PAYLOAD_PUBLIC_ALLOW_WRITES`) sind anonyme Anfragen erlaubt, `user` ist dann `null`.
 * Die Route baut aus `status` und `message` ihre eigene Antwort, damit ihr Fehlerformat gleich bleibt.
 */
export async function requireRoles(payload: Payload, headers: Headers, roles: readonly Role[]): Promise<RouteAuth> {
  const { user } = await payload.auth({ headers })
  if (!user) {
    return allowRequest(user) ? { ok: true, user: null } : { ok: false, status: 401, message: ta('Authentication required') }
  }
  if (!hasAnyRole(user as RoleUser, roles)) return { ok: false, status: 403, message: ta('You do not have permission for this action') }
  return { ok: true, user }
}
