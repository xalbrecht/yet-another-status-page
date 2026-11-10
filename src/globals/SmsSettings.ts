import type { GlobalConfig } from 'payload'
import { ta } from '@/lib/i18n/admin'

export const SmsSettings: GlobalConfig = {
  slug: 'sms-settings',
  label: ta('SMS Settings'),
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
      label: ta('Enable SMS Subscriptions'),
      admin: {
        description: ta('Allow users to subscribe via SMS (requires Twilio to be configured)'),
      },
    },
    {
      type: 'collapsible',
      label: ta('Twilio Configuration'),
      admin: {
        initCollapsed: false,
      },
      fields: [
        {
          name: 'twilioAccountSid',
          type: 'text',
          label: ta('Account SID'),
          admin: {
            description: ta('Your Twilio Account SID (starts with AC...)'),
          },
        },
        {
          name: 'twilioAuthToken',
          type: 'text',
          label: ta('Auth Token'),
          admin: {
            description: ta('Your Twilio Auth Token. Leave empty to keep existing value.'),
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
                if ((!value || value === '••••••••') && originalDoc?.twilioAuthToken) {
                  return originalDoc.twilioAuthToken
                }
                return value
              },
            ],
          },
        },
        {
          name: 'twilioFromNumber',
          type: 'text',
          label: ta('From Phone Number'),
          admin: {
            description: ta('Your Twilio phone number (e.g., +1234567890). Required if not using a Messaging Service.'),
          },
        },
        {
          name: 'twilioMessagingServiceSid',
          type: 'text',
          label: ta('Messaging Service SID'),
          admin: {
            description: ta('Use a Messaging Service instead of a phone number for better deliverability. Required if not using a From Phone Number.'),
          },
        },
      ],
    },
    {
      type: 'collapsible',
      label: ta('SMS Templates'),
      admin: {
        initCollapsed: true,
        description: ta('Configure SMS message templates. Available placeholders: {{siteName}}, {{title}}, {{status}}, {{message}}, {{url}}'),
      },
      fields: [
        {
          name: 'templateTitleMaxLength',
          type: 'number',
          label: ta('Title Max Length'),
          defaultValue: 50,
          admin: {
            description: ta('Maximum characters for {{title}} placeholder. Longer titles will be truncated.'),
            width: '50%',
          },
        },
        {
          name: 'templateMessageMaxLength',
          type: 'number',
          label: ta('Message Max Length'),
          defaultValue: 100,
          admin: {
            description: ta('Maximum characters for {{message}} placeholder. Longer messages will be truncated.'),
            width: '50%',
          },
        },
        {
          name: 'templateIncidentNew',
          type: 'textarea',
          label: ta('New Incident Template'),
          defaultValue: '[{{siteName}}] 🚨 INCIDENT: {{title}} | {{status}} | {{message}} | {{url}}',
          admin: {
            description: ta('Template for new incident notifications'),
          },
        },
        {
          name: 'templateIncidentUpdate',
          type: 'textarea',
          label: ta('Incident Update Template'),
          defaultValue: '[{{siteName}}] 📢 {{title}} | {{status}} | {{message}} | {{url}}',
          admin: {
            description: ta('Template for incident update notifications'),
          },
        },
        {
          name: 'templateMaintenanceNew',
          type: 'textarea',
          label: ta('New Maintenance Template'),
          defaultValue: '[{{siteName}}] 🔧 MAINTENANCE: {{title}} | {{schedule}} | {{url}}',
          admin: {
            description: ta('Template for new scheduled maintenance notifications. {{schedule}} includes start/end times.'),
          },
        },
        {
          name: 'templateMaintenanceUpdate',
          type: 'textarea',
          label: ta('Maintenance Update Template'),
          defaultValue: '[{{siteName}}] 🔧 {{title}} | {{status}} | {{schedule}} | {{message}} | {{url}}',
          admin: {
            description: ta('Template for maintenance update notifications'),
          },
        },
      ],
    },
  ],
}
