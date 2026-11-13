import { validateRecipients } from '@/lib/report/export/recipients'
import type { FieldAccess, GlobalConfig } from 'payload'
import { ta } from '@/lib/i18n/admin'

/** Das Global ist öffentlich lesbar (die Statusseite braucht einzelne Felder). Adressen von Mitarbeitern lesen nur angemeldete Nutzer. */
const authenticatedRead: FieldAccess = ({ req }) => Boolean(req.user)

export const EmailSettings: GlobalConfig = {
  slug: 'email-settings',
  label: ta('Email Settings'),
  admin: {
    group: ta('Configuration'),
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: false,
      label: ta('Enable Email Subscriptions'),
      admin: {
        description: ta('Allow users to subscribe via email (requires SMTP to be configured)'),
      },
    },
    {
      type: 'collapsible',
      label: ta('SMTP Configuration'),
      admin: {
        initCollapsed: false,
      },
      fields: [
        {
          name: 'smtpHost',
          type: 'text',
          label: ta('SMTP Host'),
          admin: {
            description: ta('SMTP server hostname (e.g., smtp.gmail.com, smtp.sendgrid.net)'),
          },
        },
        {
          name: 'smtpPort',
          type: 'number',
          label: ta('SMTP Port'),
          defaultValue: 587,
          admin: {
            description: ta('SMTP port (typically 587 for TLS, 465 for SSL, 25 for unencrypted)'),
          },
        },
        {
          name: 'smtpSecure',
          type: 'select',
          label: ta('Encryption'),
          defaultValue: 'tls',
          options: [
            { label: ta('TLS (STARTTLS) - Port 587'), value: 'tls' },
            { label: ta('SSL - Port 465'), value: 'ssl' },
            { label: ta('None - Port 25'), value: 'none' },
          ],
          admin: {
            description: ta('Connection security method'),
          },
        },
        {
          name: 'smtpUsername',
          type: 'text',
          label: ta('SMTP Username'),
          admin: {
            description: ta('Username for SMTP authentication (often your email address)'),
          },
        },
        {
          name: 'smtpPassword',
          type: 'text',
          label: ta('SMTP Password'),
          admin: {
            description: ta('Password or API key for SMTP authentication. Leave empty to keep existing value.'),
            autoComplete: 'new-password',
          },
          hooks: {
            afterRead: [
              ({ value, req }) => {
                // Only mask for external API responses (admin UI, REST, GraphQL)
                // Keep real value for internal local API calls (tasks, server-side code)
                const isExternalApi = req?.payloadAPI === 'REST' || req?.payloadAPI === 'GraphQL'
                if (value && isExternalApi) return '••••••••'
                return value
              },
            ],
            beforeChange: [
              ({ value, originalDoc, context }) => {
                if (context?.demoReset) return value
                // If empty or masked placeholder, keep the existing value
                if ((!value || value === '••••••••') && originalDoc?.smtpPassword) {
                  return originalDoc.smtpPassword
                }
                return value
              },
            ],
          },
        },
        {
          name: 'smtpFromAddress',
          type: 'email',
          label: ta('From Email Address'),
          admin: {
            description: ta('Email address that notifications will be sent from'),
          },
        },
        {
          name: 'smtpFromName',
          type: 'text',
          label: ta('From Name'),
          admin: {
            description: ta('Display name for the sender (e.g., "Acme Status")'),
          },
        },
        {
          name: 'smtpReplyTo',
          type: 'email',
          label: ta('Reply-To Address'),
          admin: {
            description: ta('Optional reply-to email address (leave empty to use From address)'),
          },
        },
        {
          name: 'subscriberRequestTo',
          type: 'email',
          access: { read: authenticatedRead },
          label: ta('Address for new subscription requests'),
          admin: {
            description: ta('Receives a message for every new subscription so that it can be approved. Leave empty to send none'),
          },
        },
        {
          name: 'reportRecipients',
          type: 'textarea',
          access: { read: authenticatedRead },
          label: ta('Recipients of the availability report', 'Empfänger des Verfügbarkeitsberichts'),
          validate: (value: string | null | undefined) => validateRecipients(value),
          admin: {
            description: ta('One address per line or separated by commas. Leave empty to send none', 'Eine Adresse je Zeile oder durch Komma getrennt. Leer: kein Versand'),
          },
        },
      ],
    },
  ],
}
