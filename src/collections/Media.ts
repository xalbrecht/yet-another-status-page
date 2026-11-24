import type { CollectionConfig } from 'payload'
import { ta } from '@/lib/i18n/admin'
import { rolesAccess } from '@/lib/access'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: ta('Media', 'single'), plural: ta('Media') },
  admin: {
    group: ta('Admin'),
  },
  access: {
    read: () => true,
    create: rolesAccess(['admin', 'servicedesk']),
    update: rolesAccess(['admin', 'servicedesk']),
    delete: rolesAccess(['admin', 'servicedesk']),
  },
  upload: {
    staticDir: 'public/media',
    mimeTypes: ['image/*', 'application/pdf'],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      label: ta('Alt Text'),
      admin: {
        description: ta('Alternative text for accessibility'),
      },
    },
  ],
}
