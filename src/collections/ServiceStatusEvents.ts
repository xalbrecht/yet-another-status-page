import type { CollectionConfig } from 'payload'
import { authenticatedOrTestWrite } from '@/lib/access'
import { ta } from '@/lib/i18n/admin'
import { invalidateLagebild } from '@/lib/lagebild-invalidate'
import { serviceStatusOptions } from './Services'

/**
 * Protokoll der Zustandsänderungen von Diensten.
 * Einträge entstehen ausschließlich automatisch (Hook an der Collection „Dienste“).
 * Das Lagebild berechnet daraus die Balken und die 14-Tage-Übersicht.
 */
export const ServiceStatusEvents: CollectionConfig = {
  slug: 'service-status-events',
  labels: {
    singular: ta('Status log entry', 'Protokolleintrag'),
    plural: ta('Status log', 'Statusprotokoll'),
  },
  admin: {
    useAsTitle: 'changedAt',
    defaultColumns: ['service', 'status', 'changedAt'],
    group: ta('Status'),
    description: ta('Automatic log of service status changes. Used for the situation overview.'),
  },
  defaultSort: '-changedAt',
  hooks: {
    afterChange: [
      ({ doc }) => {
        invalidateLagebild()
        return doc
      },
    ],
    afterDelete: [
      ({ doc }) => {
        invalidateLagebild()
        return doc
      },
    ],
  },
  access: {
    read: authenticatedOrTestWrite,
    // Einträge werden nur vom System angelegt (Local API umgeht diese Regeln)
    create: () => false,
    update: () => false,
    delete: authenticatedOrTestWrite,
  },
  fields: [
    {
      name: 'service',
      type: 'relationship',
      relationTo: 'services',
      required: true,
      index: true,
      label: ta('Service', 'Dienst'),
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [...serviceStatusOptions],
      label: ta('Status', 'Status'),
    },
    {
      name: 'changedAt',
      type: 'date',
      required: true,
      index: true,
      defaultValue: () => new Date().toISOString(),
      label: ta('Changed at', 'Geändert am'),
    },
  ],
}
