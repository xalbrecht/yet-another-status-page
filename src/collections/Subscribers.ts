import type { CollectionConfig } from 'payload'
import { isTestMode, rolesAccess, rolesFieldAccess } from '@/lib/access'
import { generateShortId } from '@/lib/shortId'
import { ta } from '@/lib/i18n/admin'

const adminFieldAccess = rolesFieldAccess(['admin'])

export const subscriptionTypeOptions = [
  { label: ta('Email'), value: 'email' },
  { label: ta('SMS'), value: 'sms' },
] as const

export type SubscriptionType = (typeof subscriptionTypeOptions)[number]['value']

interface SubscriberData {
  type?: SubscriptionType
  email?: string
  phone?: string
  verified?: boolean
  addressConfirmed?: boolean
  active?: boolean
}

export const Subscribers: CollectionConfig = {
  slug: 'subscribers',
  labels: { singular: ta('Subscriber'), plural: ta('Subscribers') },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['type', 'email', 'phone', 'verified', 'addressConfirmed', 'active', 'isTest', 'createdAt'],
    group: ta('Notifications'),
  },
  access: {
    read: rolesAccess(['admin']),
    create: rolesAccess(['admin']), // Public sign-ups go through POST /api/subscribe (local API)
    update: rolesAccess(['admin']),
    delete: rolesAccess(['admin']),
  },
  fields: [
    {
      name: 'type',
      label: ta('Type'),
      type: 'select',
      required: true,
      defaultValue: 'email',
      options: [...subscriptionTypeOptions],
      admin: {
        description: ta('Type of subscription'),
      },
    },
    {
      name: 'email',
      type: 'email',
      label: ta('Email Address'),
      admin: {
        description: ta('Required if subscription type is email'),
        condition: (data) => (data as SubscriberData)?.type === 'email',
      },
      validate: async (
        value: string | null | undefined,
        { data, req, id }: { data: Partial<SubscriberData>; req: { payload?: unknown }; id?: string | number },
      ) => {
        if (data?.type === 'email' && !value) {
          return ta('Email is required for email subscriptions')
        }

        // Check uniqueness for email subscriptions
        if (value && data?.type === 'email' && req.payload) {
          const payload = req.payload as {
            find: (args: {
              collection: string
              where: Record<string, unknown>
              limit: number
            }) => Promise<{ docs: Array<{ id: string | number }> }>
          }
          const existing = await payload.find({
            collection: 'subscribers',
            where: {
              email: { equals: value },
              type: { equals: 'email' },
              ...(id ? { id: { not_equals: id } } : {}),
            },
            limit: 1,
          })
          if (existing.docs.length > 0) {
            return ta('This email address is already subscribed')
          }
        }

        return true
      },
    },
    {
      name: 'phone',
      type: 'text',
      label: ta('Phone Number'),
      admin: {
        description: ta('Required if subscription type is SMS (include country code)'),
        condition: (data) => (data as SubscriberData)?.type === 'sms',
      },
      validate: async (
        value: string | null | undefined,
        { data, req, id }: { data: Partial<SubscriberData>; req: { payload?: unknown }; id?: string | number },
      ) => {
        if (data?.type === 'sms' && !value) {
          return ta('Phone number is required for SMS subscriptions')
        }
        if (value && !/^\+?[1-9]\d{6,14}$/.test(value)) {
          return ta('Please enter a valid phone number (e.g., +1234567890)')
        }

        // Check uniqueness for SMS subscriptions
        if (value && data?.type === 'sms' && req.payload) {
          const payload = req.payload as {
            find: (args: {
              collection: string
              where: Record<string, unknown>
              limit: number
            }) => Promise<{ docs: Array<{ id: string | number }> }>
          }
          const existing = await payload.find({
            collection: 'subscribers',
            where: {
              phone: { equals: value },
              type: { equals: 'sms' },
              ...(id ? { id: { not_equals: id } } : {}),
            },
            limit: 1,
          })
          if (existing.docs.length > 0) {
            return ta('This phone number is already subscribed')
          }
        }

        return true
      },
    },
    {
      name: 'verified',
      type: 'checkbox',
      // Public sign-ups must not approve themselves
      access: { create: adminFieldAccess, update: adminFieldAccess },
      defaultValue: false,
      label: ta('Approved'),
      admin: {
        description: ta('Operator approval. Email subscribers receive notifications only when approved and the address is confirmed, SMS subscribers when approved'),
      },
    },
    {
      name: 'addressConfirmed',
      type: 'checkbox',
      // Public sign-ups must not approve themselves
      access: { create: adminFieldAccess, update: adminFieldAccess },
      defaultValue: false,
      label: ta('Address confirmed'),
      admin: {
        description: ta('Set when the subscriber clicked the link in the confirmation email'),
      },
    },
    {
      name: 'verificationToken',
      type: 'text',
      // The response to a public create must not reveal the token
      access: { read: adminFieldAccess },
      label: ta('Verification Token'),
      admin: {
        description: ta('Token used for email/phone verification'),
        readOnly: true,
      },
      hooks: {
        beforeValidate: [
          ({ value, operation, req }) => {
            // A public sign-up must not choose its own token: always generate one
            if (operation === 'create' && (!value || !(req.user || isTestMode()))) {
              // Generate a secure random verification token
              return generateShortId(24)
            }
            return value
          },
        ],
      },
    },
    {
      name: 'unsubscribeToken',
      type: 'text',
      // The response to a public create must not reveal the token
      access: { read: adminFieldAccess },
      label: ta('Unsubscribe Token'),
      unique: true,
      admin: {
        description: ta('Token used for one-click unsubscribe'),
        readOnly: true,
      },
      hooks: {
        beforeValidate: [
          ({ value, operation, req }) => {
            if (operation === 'create' && (!value || !(req.user || isTestMode()))) {
              // Generate a secure unique unsubscribe token
              return generateShortId(32)
            }
            return value
          },
        ],
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      label: ta('Active'),
      admin: {
        description: ta('Whether the subscription is active'),
      },
    },
    {
      name: 'isTest',
      type: 'checkbox',
      defaultValue: false,
      label: ta('Test record'),
      // Public sign-ups never set or read this marker (like the approval flags)
      access: { read: adminFieldAccess, create: adminFieldAccess, update: adminFieldAccess },
      admin: {
        position: 'sidebar',
        description: ta('Only a marker for takeover and evaluation. Changes no behavior: test subscribers still receive notifications, test users can still sign in'),
      },
    },
    {
      name: 'ipAddress',
      type: 'text',
      label: ta('IP Address'),
      index: true,
      admin: {
        description: ta('IP address used when subscribing (for rate limiting)'),
        readOnly: true,
        position: 'sidebar',
      },
    },
  ],
}
