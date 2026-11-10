import type { CollectionConfig } from 'payload'
import { ta } from '@/lib/i18n/admin'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: ta('Media', 'Medium'), plural: ta('Media', 'Medien') },
  admin: {
    group: ta('Admin'),
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => !!user,
    update: ({ req: { user } }) => !!user,
    delete: ({ req: { user } }) => !!user,
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
