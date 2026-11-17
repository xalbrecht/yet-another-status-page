import type { CollectionConfig } from 'payload'
import { standardAccess } from '@/lib/access'
import { ta } from '@/lib/i18n/admin'
import { invalidateLagebild } from '@/lib/lagebild-invalidate'
import { localizedDateAdmin } from '@/lib/localizedDateAdmin'
import { resolveDateTimeConfig } from '@/lib/datetime'
import { dayBoundary, endsAtBeforeStart } from '@/lib/service-lifecycle'

export const serviceStatusOptions = [
  { label: ta('Operational'), value: 'operational' },
  { label: ta('Degraded Performance'), value: 'degraded' },
  { label: ta('Partial Outage'), value: 'partial' },
  { label: ta('Major Outage'), value: 'major' },
  { label: ta('Under Maintenance'), value: 'maintenance' },
] as const

export type ServiceStatus = (typeof serviceStatusOptions)[number]['value']

/** Rundet die Eingabe auf Tagesanfang (Beginn) bzw. Tagesende (Ende) in der Zeitzone der Installation. */
const toDayBoundary =
  (edge: 'start' | 'end') =>
  async ({ value, req }: { value?: unknown; req: { payload: { findGlobal: (args: { slug: 'settings' }) => Promise<unknown> } } }) => {
    if (typeof value !== 'string' && !(value instanceof Date)) return value
    const settings = (await req.payload.findGlobal({ slug: 'settings' })) as Parameters<typeof resolveDateTimeConfig>[0]
    return dayBoundary(new Date(value), edge, resolveDateTimeConfig(settings).timezone).toISOString()
  }

export const Services: CollectionConfig = {
  slug: 'services',
  labels: { singular: ta('Service'), plural: ta('Services') },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'group', 'status', 'startsAt', 'endsAt', 'updatedAt'],
    group: ta('Status'),
  },
  orderable: true,
  access: standardAccess,
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        // Zustandsänderung ins Statusprotokoll schreiben (Grundlage des Lagebilds)
        if (operation === 'create' || previousDoc?.status !== doc.status) {
          await req.payload.create({
            collection: 'service-status-events',
            data: { service: doc.id, status: doc.status, changedAt: new Date().toISOString(), source: 'operation' },
            req,
          })
        }
        invalidateLagebild()
        return doc
      },
    ],
    // Die Einträge müssen vor dem Dienst entfallen: Der Fremdschlüssel steht auf
    // „ON DELETE SET NULL“, die Spalte ist aber NOT NULL. Ein Löschen danach scheitert mit HTTP 500.
    beforeDelete: [
      async ({ id, req }) => {
        await req.payload.delete({
          collection: 'service-status-events',
          where: { service: { equals: id } },
          req,
        })
      },
    ],
    afterDelete: [
      () => {
        invalidateLagebild()
      },
    ],
  },
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
      label: ta('Status'),
      type: 'select',
      required: true,
      defaultValue: 'operational',
      options: [...serviceStatusOptions],
      admin: {
        description: ta('Current status of the service'),
      },
    },
    {
      name: 'startsAt',
      type: 'date',
      required: true,
      label: ta('Start'),
      defaultValue: () => new Date().toISOString(),
      hooks: { beforeValidate: [toDayBoundary('start')] },
      admin: localizedDateAdmin({
        position: 'sidebar',
        pickerAppearance: 'dayOnly',
        description: ta('First day the service is operated. Before this day it does not appear on the status page'),
      }),
    },
    {
      name: 'endsAt',
      type: 'date',
      label: ta('End'),
      hooks: { beforeValidate: [toDayBoundary('end')] },
      validate: (value: unknown, { data }: { data?: Record<string, unknown> }) => {
        const startsAt = data?.startsAt as string | undefined
        if (value && startsAt && endsAtBeforeStart(startsAt, value as string)) return ta('The end must not be before the start')
        return true
      },
      admin: localizedDateAdmin({
        position: 'sidebar',
        pickerAppearance: 'dayOnly',
        description: ta('Last day the service is operated. The end day still counts. Leave empty while the service is operated'),
      }),
    },
    {
      // Zielwert des Dienstes. Noch ohne Eingabe im Admin, leer = erbt von Gruppe oder Gesamt.
      name: 'availabilityTarget',
      type: 'number',
      label: ta('Availability target (%)'),
      min: 0,
      max: 100,
      admin: { hidden: true },
    },
  ],
}
