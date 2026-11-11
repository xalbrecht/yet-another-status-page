import type { Access, FieldAccess } from 'payload'

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
