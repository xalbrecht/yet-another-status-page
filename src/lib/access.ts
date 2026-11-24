import type { Access, FieldAccess } from 'payload'
import { hasRole, type RoleUser } from '@/lib/roles'

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

/**
 * Allows write access only to authenticated users, 
 * or everyone in test mode
 */
export const authenticatedOrTestWrite: Access = ({ req: { user } }) => {
  if (isTestMode()) return true
  return !!user
}

/**
 * Field-level variant of `authenticatedOrTestWrite`: for fields that the public
 * must not set or read (approval flags, tokens) on collections with public create.
 */
export const authenticatedOrTestWriteField: FieldAccess = ({ req: { user } }) => {
  if (isTestMode()) return true
  return !!user
}

/**
 * Standard CRUD access for most collections:
 * - Read: Public
 * - Create/Update/Delete: Authenticated users or test mode
 */
export const standardAccess = {
  read: publicRead,
  create: authenticatedOrTestWrite,
  update: authenticatedOrTestWrite,
  delete: authenticatedOrTestWrite,
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
