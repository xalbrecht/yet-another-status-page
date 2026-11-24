import type { CollectionConfig, Field, PayloadRequest } from 'payload'
import { isLocalLoginDisabled } from '@/lib/oidc'
import { isDemoMode, getDemoUserEmail } from '@/lib/demo'
import { getServerUrl } from '@/lib/utils'
import { ta } from '@/lib/i18n/admin'
import { adminOnly, adminOnlyField, adminOrSelf } from '@/lib/access'
import { ROLES, hasAnyRole, hasRole, type Role, type RoleUser } from '@/lib/roles'

const isProduction = process.env.NODE_ENV === 'production'

// Check if password login should be disabled (SSO-only mode)
const disablePasswordLogin = isLocalLoginDisabled()

// Extract cookie domain from SERVER_URL
const getCookieDomain = (): string | undefined => {
  const serverUrl = getServerUrl()
  try {
    const url = new URL(serverUrl)
    // For localhost, return undefined (no domain restriction)
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return undefined
    }
    // Return the hostname for cookie domain
    return url.hostname
  } catch {
    return undefined
  }
}

const hasRoleInData = (data: unknown, role: Role): boolean => {
  const roles = (data as { roles?: unknown } | undefined)?.roles
  return Array.isArray(roles) && roles.includes(role)
}

/** Felder „alle Dienstgruppen“ und „Dienstgruppen“ einer Rolle, sichtbar nur bei gesetzter Rolle. Leer bedeutet: keine Gruppe. */
const scopeFields = (role: 'servicedesk' | 'produktmanager', labels: { all: string; groups: string }): Field[] => [
  {
    name: `${role}AlleGruppen`,
    type: 'checkbox',
    defaultValue: false,
    label: labels.all,
    access: { create: adminOnlyField, update: adminOnlyField },
    admin: {
      condition: (data) => hasRoleInData(data, role),
      description: ta('Without this checkbox and without a service group the role has no access'),
    },
  },
  {
    name: `${role}Gruppen`,
    type: 'relationship',
    relationTo: 'service-groups',
    hasMany: true,
    label: labels.groups,
    access: { create: adminOnlyField, update: adminOnlyField },
    admin: {
      condition: (data) => hasRoleInData(data, role) && !(data as Record<string, unknown>)[`${role}AlleGruppen`],
    },
  },
]

/** Zählt die Admins außer dem Benutzer mit der Kennung `exceptId`. */
const otherAdmins = async (req: PayloadRequest, exceptId: number | string): Promise<number> =>
  (
    await req.payload.count({
      collection: 'users',
      overrideAccess: true,
      where: { and: [{ roles: { equals: 'admin' } }, { id: { not_equals: exceptId } }] },
      req,
    })
  ).totalDocs

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: ta('User'), plural: ta('Users') },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'roles', 'isTest', 'createdAt'],
    group: ta('Admin'),
  },
  auth: {
    useAPIKey: true,
    // Disable database sessions - use stateless JWT
    // Sessions cause issues behind reverse proxy
    useSessions: false,
    cookies: {
      domain: getCookieDomain(),
      secure: isProduction,
      sameSite: 'Lax',
    },
    // Disable password login when OIDC_DISABLE_LOCAL_LOGIN=true
    // Keep email field for user identification
    ...(disablePasswordLogin && {
      disableLocalStrategy: {
        enableFields: true,
      },
    }),
  },
  access: {
    // Zugang zum Admin-Bereich nur mit mindestens einer Rolle
    admin: ({ req: { user } }) => hasAnyRole(user as RoleUser, ROLES),
    // Admins verwalten alle Benutzer, alle anderen sehen und ändern nur den eigenen Datensatz (ohne Rollenfelder)
    read: adminOrSelf,
    create: adminOnly,
    update: adminOrSelf,
    delete: adminOnly,
  },
  hooks: {
    // Der erste Benutzer einer leeren Installation wird Admin, sonst sperrt sich die Erstinstallation aus
    beforeValidate: [
      async ({ data, operation, req }) => {
        if (operation !== 'create' || !data) return data
        const { totalDocs } = await req.payload.count({ collection: 'users', overrideAccess: true, req })
        return totalDocs === 0 ? { ...data, roles: ['admin'] } : data
      },
    ],
    // Der letzte Admin behält die Rolle und bleibt bestehen
    beforeDelete: [
      async ({ id, req }) => {
        const doc = (await req.payload.findByID({ collection: 'users', id, depth: 0, overrideAccess: true, req })) as RoleUser
        if (hasRole(doc, 'admin') && (await otherAdmins(req, id)) === 0) throw new Error(ta('The last admin cannot be deleted.'))
      },
    ],
    beforeChange: [
      async ({ data, originalDoc, operation, req }) => {
        if (operation === 'update' && hasRole(originalDoc as RoleUser, 'admin') && Array.isArray(data?.roles) && !data.roles.includes('admin')) {
          if ((await otherAdmins(req, originalDoc.id)) === 0) throw new Error(ta('The last admin cannot lose the admin role.'))
        }
        return data
      },
      ({ data, originalDoc, operation, req }) => {
        // In demo mode, block password changes for the demo user when the
        // request comes from a logged-in admin UI session. Internal calls
        // (seed/reset) run without `req.user`, so they remain allowed.
        if (isDemoMode() && operation === 'update' && req.user) {
          const email = data?.email || originalDoc?.email
          if (email === getDemoUserEmail() && data?.password) {
            throw new Error(ta('Password changes are disabled in demo mode.'))
          }
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: ta('Full Name'),
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      label: ta('Roles'),
      access: { create: adminOnlyField, update: adminOnlyField },
      options: [
        { label: ta('Admin', 'role'), value: 'admin' },
        { label: ta('Service desk'), value: 'servicedesk' },
        { label: ta('Product manager'), value: 'produktmanager' },
      ],
      admin: {
        description: ta('User roles for access control. Without a role the user cannot enter the admin area. The rights of several roles add up'),
      },
    },
    ...scopeFields('servicedesk', { all: ta('Service desk: all service groups'), groups: ta('Service desk: service groups') }),
    ...scopeFields('produktmanager', { all: ta('Product manager: all service groups'), groups: ta('Product manager: service groups') }),
    {
      name: 'isTest',
      type: 'checkbox',
      defaultValue: false,
      label: ta('Test record'),
      admin: {
        position: 'sidebar',
        description: ta('Only a marker for takeover and evaluation. Changes no behavior: test subscribers still receive notifications, test users can still sign in'),
      },
    },
  ],
}
