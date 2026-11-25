import type { CollectionConfig } from 'payload'
import { publicRead, rolesAccess } from '@/lib/access'
import { ta } from '@/lib/i18n/admin'
import { DEFAULT_GROUP_ICON } from '@/lib/group-icons'
import { groupIconOptions } from '@/lib/group-icon-options'
import { invalidateLagebild } from '@/lib/lagebild-invalidate'

export const ServiceGroups: CollectionConfig = {
  slug: 'service-groups',
  labels: { singular: ta('Service Group'), plural: ta('Service Groups') },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'updatedAt'],
    group: ta('Status'),
  },
  orderable: true,
  access: {
    read: publicRead,
    create: rolesAccess(['admin']),
    update: rolesAccess(['admin']),
    delete: rolesAccess(['admin']),
  },
  hooks: {
    // Name, Symbol und Reihenfolge der Gruppen stehen im zwischengespeicherten Lagebild
    afterChange: [
      ({ doc }) => {
        invalidateLagebild()
        return doc
      },
    ],
    // Abonnenten, deren letzte gewählte Gruppe gelöscht wird, hätten sonst keine Gruppe mehr und erhielten nichts:
    // Sie gelten danach als „alle Dienstgruppen“. Die Verknüpfungszeilen löscht die Datenbank mit.
    beforeDelete: [
      async ({ id, req }) => {
        const found = await req.payload.find({
          collection: 'subscribers',
          where: { and: [{ allGroups: { equals: false } }, { groups: { in: [id] } }] },
          depth: 0,
          pagination: false,
          req,
        })
        req.context.subscribersWithoutGroup = found.docs
          .filter((subscriber) => Array.isArray(subscriber.groups) && subscriber.groups.length <= 1)
          .map((subscriber) => subscriber.id)
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        const ids = (req.context.subscribersWithoutGroup as Array<number | string> | undefined) ?? []
        if (ids.length > 0) {
          await req.payload.update({ collection: 'subscribers', where: { id: { in: ids } }, data: { allGroups: true }, req })
        }
        invalidateLagebild()
        return doc
      },
    ],
  },
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
      label: ta('Slug'),
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
    {
      name: 'icon',
      type: 'select',
      label: ta('Icon'),
      defaultValue: DEFAULT_GROUP_ICON,
      options: [...groupIconOptions],
      admin: {
        description: ta('Icon for this group in the situation overview on the status page'),
        components: {
          // Raster aller Symbole mit Namen statt einer Auswahlliste
          Field: '@/components/admin/group-icon-field/GroupIconField#GroupIconField',
        },
      },
    },
    {
      // Zielwert der Gruppe. Noch ohne Eingabe im Admin, leer = erbt vom Gesamtzielwert.
      name: 'availabilityTarget',
      type: 'number',
      label: ta('Availability target (%)'),
      min: 0,
      max: 100,
      admin: { hidden: true },
    },
  ],
}
