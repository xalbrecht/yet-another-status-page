import { validateRecipients } from '@/lib/report/export/recipients'
import { MAIL_PART_LIMIT_DEFAULT_MB, MAIL_PART_LIMIT_MAX_MB, MAIL_PART_LIMIT_MIN_MB } from '@/lib/report/export/mail-limit'
import type { FieldAccess, GlobalConfig } from 'payload'
import { ta } from '@/lib/i18n/admin'

/** Das Global ist öffentlich lesbar (die Statusseite braucht einzelne Felder). Adressen von Mitarbeitern und die SMTP-Angaben (Server, Benutzer, Absender) lesen nur angemeldete Nutzer. Server-Code liest über die lokale API ohne Feldprüfung. */
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
          access: { read: authenticatedRead },
          type: 'text',
          label: ta('SMTP Host'),
          admin: {
            description: ta('SMTP server hostname (e.g., smtp.gmail.com, smtp.sendgrid.net)'),
          },
        },
        {
          name: 'smtpPort',
          access: { read: authenticatedRead },
          type: 'number',
          label: ta('SMTP Port'),
          defaultValue: 587,
          admin: {
            description: ta('SMTP port (typically 587 for TLS, 465 for SSL, 25 for unencrypted)'),
          },
        },
        {
          name: 'smtpSecure',
          access: { read: authenticatedRead },
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
          access: { read: authenticatedRead },
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
          access: { read: authenticatedRead },
          type: 'email',
          label: ta('From Email Address'),
          admin: {
            description: ta('Email address that notifications will be sent from'),
          },
        },
        {
          name: 'smtpFromName',
          access: { read: authenticatedRead },
          type: 'text',
          label: ta('From Name'),
          admin: {
            description: ta('Display name for the sender (e.g., "Acme Status")'),
          },
        },
        {
          name: 'smtpReplyTo',
          access: { read: authenticatedRead },
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
          label: ta('Recipients of the availability report'),
          validate: (value: string | null | undefined) => validateRecipients(value),
          admin: {
            description: ta('One address per line or separated by commas. Leave empty to send none'),
          },
        },
        {
          name: 'reportMailLimitMb',
          type: 'number',
          access: { read: authenticatedRead },
          label: ta('Size limit per email of the availability report (MB)'),
          defaultValue: MAIL_PART_LIMIT_DEFAULT_MB,
          min: MAIL_PART_LIMIT_MIN_MB,
          max: MAIL_PART_LIMIT_MAX_MB,
          admin: {
            description: ta(
              'Largest total size of the attachments of one email. A larger report is split into several emails. Choose a value below the limit of your mail server: attachments grow by about a third in transit. Empty means 6 MB',
            ),
          },
        },
      ],
    },
  ],
}
