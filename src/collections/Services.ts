import type { CollectionConfig } from 'payload'
import { standardAccess } from '@/lib/access'
import { ta } from '@/lib/i18n/admin'

export const serviceStatusOptions = [
  { label: ta('Operational'), value: 'operational' },
  { label: ta('Degraded Performance'), value: 'degraded' },
  { label: ta('Partial Outage'), value: 'partial' },
  { label: ta('Major Outage'), value: 'major' },
  { label: ta('Under Maintenance'), value: 'maintenance' },
] as const

export type ServiceStatus = (typeof serviceStatusOptions)[number]['value']

export const Services: CollectionConfig = {
  slug: 'services',
  labels: { singular: ta('Service', 'Dienst'), plural: ta('Services', 'Dienste') },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'group', 'status', 'updatedAt'],
    group: ta('Status'),
  },
  orderable: true,
  access: standardAccess,
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: ta('Service Name'),
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: ta('URL-friendly identifier (e.g., "api-gateway")'),
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
        description: ta('Optional description for this service'),
      },
    },
    {
      name: 'group',
      type: 'relationship',
      relationTo: 'service-groups',
      required: true,
      label: ta('Service Group'),
      admin: {
        description: ta('Which group this service belongs to'),
      },
    },
    {
      name: 'status',
      label: ta('Status', 'Status'),
      type: 'select',
      required: true,
      defaultValue: 'operational',
      options: [...serviceStatusOptions],
      admin: {
        description: ta('Current status of the service'),
      },
    },
  ],
}
