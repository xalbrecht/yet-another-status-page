import type { CollectionConfig } from 'payload'
import { estimateRecipients } from '@/lib/recipient-count'
import { localizedDateAdmin } from '@/lib/localizedDateAdmin'
import { ta } from '@/lib/i18n/admin'
import { notificationScopedCreate, notificationScopedRead, notificationScopedWrite } from '@/lib/access'
import { NTFY_TEXT_MAX_LENGTH } from '@/lib/message-templates'

export const notificationChannelOptions = [
  { label: ta('Email'), value: 'email' },
  { label: ta('SMS'), value: 'sms' },
  { label: ta('Both'), value: 'both' },
] as const

export const notificationStatusOptions = [
  { label: ta('Draft'), value: 'draft' },
  { label: ta('Scheduled'), value: 'scheduled' },
  { label: ta('Sent'), value: 'sent' },
  { label: ta('Failed'), value: 'failed' },
] as const

export type NotificationChannel = (typeof notificationChannelOptions)[number]['value']
export type NotificationStatus = (typeof notificationStatusOptions)[number]['value']

export const Notifications: CollectionConfig = {
  slug: 'notifications',
  labels: { singular: ta('Notification'), plural: ta('Notifications') },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'channel', 'status', 'recipientCount', 'createdAt'],
    group: ta('Notifications'),
    description: ta('Manage and send notifications to subscribers'),
  },
  access: {
    read: notificationScopedRead,
    create: notificationScopedCreate,
    update: notificationScopedWrite,
    delete: notificationScopedWrite,
  },
  hooks: {
    afterRead: [
      async ({ doc, req }) => {
        // Entwürfe und geplante Meldungen: geschätzte Empfängerzahl (je Anfrage nur einmal gezählt, s. recipient-count.ts)
        if (doc.status === 'draft' || doc.status === 'scheduled') {
          try {
            return { ...doc, recipientCount: await estimateRecipients(req.payload, doc, req) }
          } catch (error) {
            console.error('Error computing recipient count:', error)
            return doc
          }
        }
        return doc
      },
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: ta('Notification Title'),
      admin: {
        description: ta('Internal title for this notification (auto-generated)'),
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'relatedIncident',
          type: 'relationship',
          relationTo: 'incidents',
          label: ta('Related Incident'),
          admin: {
            width: '50%',
            condition: (data) => !data?.relatedMaintenance,
          },
        },
        {
          name: 'relatedMaintenance',
          type: 'relationship',
          relationTo: 'maintenances',
          label: ta('Related Maintenance'),
          admin: {
            width: '50%',
            condition: (data) => !data?.relatedIncident,
          },
        },
      ],
    },
    {
      name: 'updateIndex',
      type: 'number',
      label: ta('Update Index'),
      admin: {
        hidden: true,
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'channel',
          label: ta('Channel'),
          type: 'select',
          required: true,
          defaultValue: 'both',
          options: [...notificationChannelOptions],
          admin: {
            width: '50%',
          },
        },
        {
          name: 'status',
          label: ta('Status'),
          type: 'select',
          required: true,
          defaultValue: 'draft',
          options: [...notificationStatusOptions],
          admin: {
            width: '50%',
          },
        },
      ],
    },
    {
      name: 'subject',
      type: 'text',
      label: ta('Email Subject'),
      admin: {
        description: ta('Subject line for email notifications'),
        condition: (data) => data?.channel !== 'sms',
      },
    },
    {
      name: 'emailBody',
      type: 'textarea',
      label: ta('Email Body'),
      admin: {
        description: ta('Full email message content. Use {{siteUrl}} for the site URL.'),
        condition: (data) => data?.channel !== 'sms',
      },
    },
    {
      name: 'smsBody',
      type: 'textarea',
      label: ta('SMS Message'),
      admin: {
        description: ta('Short SMS message (160 characters recommended)'),
        condition: (data) => data?.channel !== 'email',
      },
    },
    {
      name: 'ntfyBody',
      type: 'textarea',
      label: ta('ntfy message'),
      // Dieselbe Grenze wie der ntfy-Text der Vorlagen
      maxLength: NTFY_TEXT_MAX_LENGTH,
      admin: {
        rows: 3,
        description: ta(
          'Optional. A short text for a push message via ntfy (up to 500 characters). The application does not send it itself: a connection that reads sent notifications through the API can use it.',
        ),
      },
    },
    {
      name: 'sendButton',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/admin/SendNotificationCollectionButton#SendNotificationCollectionButton',
        },
      },
    },
    {
      name: 'recipientCountDisplay',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/admin/RecipientCountField#RecipientCountField',
        },
      },
    },
    {
      name: 'recipientCount',
      type: 'number',
      label: ta('Recipients'),
      admin: {
        hidden: true,
      },
    },
    {
      name: 'errorMessage',
      label: ta('Error Message'),
      type: 'textarea',
      admin: {
        hidden: true,
      },
    },
    {
      name: 'sentAt',
      type: 'date',
      label: ta('Sent At'),
      admin: {
        ...localizedDateAdmin({
          readOnly: true,
          condition: (data) => (data as { status?: string })?.status === 'sent',
        }),
      },
    },
  ],
}
