import type { CollectionConfig } from 'payload'
import { standardAccess } from '@/lib/access'
import { ta } from '@/lib/i18n/admin'

export const ServiceGroups: CollectionConfig = {
  slug: 'service-groups',
  labels: { singular: ta('Service Group', 'Dienstgruppe'), plural: ta('Service Groups', 'Dienstgruppen') },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'updatedAt'],
    group: ta('Status'),
  },
  orderable: true,
  access: standardAccess,
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: ta('Group Name'),
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: ta('URL-friendly identifier (e.g., "core-infrastructure")'),
      },
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            if (!value && data?.name) {
              return data.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '')
            }
            return value
          },
        ],
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: ta('Description'),
      admin: {
        description: ta('Optional description for this service group'),
      },
    },
  ],
}
