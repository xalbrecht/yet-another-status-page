import type { GlobalConfig } from 'payload'
import { authenticatedOrTestWrite } from '@/lib/access'
import { TIMEZONE_OPTIONS } from '@/lib/datetime'
import { ta } from '@/lib/i18n/admin'
import { translatorsFor } from '@/lib/i18n/translators'

export const Settings: GlobalConfig = {
  slug: 'settings',
  label: ta('Site Settings'),
  admin: {
    group: ta('Configuration'),
  },
  access: {
    read: () => true,
    update: authenticatedOrTestWrite,
  },
  fields: [
    // General Settings
    {
      type: 'collapsible',
      label: ta('General'),
      admin: {
        initCollapsed: false,
      },
      fields: [
        {
          name: 'siteName',
          type: 'text',
          required: true,
          defaultValue: 'Status Page',
          label: ta('Site Name'),
          admin: {
            description: ta('The name of your organization/site'),
          },
        },
        {
          name: 'siteDescription',
          type: 'textarea',
          label: ta('Site Description'),
          admin: {
            description: ta('A brief description of your status page'),
          },
        },
        {
          name: 'footerText',
          type: 'richText',
          label: ta('Footer Text'),
          admin: {
            description: ta('Text displayed in the footer. Supports bold, italic, underline, and links.'),
          },
        },
      ],
    },
    // SEO Settings
    {
      type: 'collapsible',
      label: ta('SEO'),
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'metaTitle',
          type: 'text',
          label: ta('Meta Title'),
          admin: {
            description: ta('Title shown in browser tabs and search results (leave empty to use Site Name)'),
          },
        },
        {
          name: 'metaDescription',
          type: 'textarea',
          label: ta('Meta Description'),
          admin: {
            description: ta('Description shown in search results'),
          },
        },
        {
          name: 'historyMetaTitle',
          type: 'text',
          label: ta('History Page Meta Title'),
          admin: {
            description: ta('Title for the incident history page (use {{date}} for dynamic date)'),
          },
        },
        {
          name: 'historyMetaDescription',
          type: 'textarea',
          label: ta('History Page Meta Description'),
          admin: {
            description: ta('Description for the incident history page (use {{date}} for dynamic date)'),
          },
        },
      ],
    },
    // Branding Settings
    {
      type: 'collapsible',
      label: ta('Branding'),
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'favicon',
          type: 'upload',
          relationTo: 'media',
          label: ta('Favicon'),
          admin: {
            description: ta('Site favicon (recommended: 32x32 or 64x64 PNG, ICO, or SVG). Leave empty to use default favicon.'),
          },
        },
        {
          name: 'logoLight',
          type: 'upload',
          relationTo: 'media',
          label: ta('Logo (Light Theme)'),
          admin: {
            description: ta('Logo to display on light backgrounds (recommended: SVG or PNG with transparent background)'),
          },
        },
        {
          name: 'logoDark',
          type: 'upload',
          relationTo: 'media',
          label: ta('Logo (Dark Theme)'),
          admin: {
            description: ta('Logo to display on dark backgrounds (recommended: SVG or PNG with transparent background)'),
          },
        },
      ],
    },
    // Status Override Settings
    {
      type: 'collapsible',
      label: ta('Status Override'),
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'maintenanceModeEnabled',
          type: 'checkbox',
          defaultValue: false,
          label: ta('Enable Maintenance Mode'),
          admin: {
            description: ta('Force display of maintenance banner regardless of service status'),
          },
        },
        {
          name: 'customStatusMessage',
          type: 'textarea',
          label: ta('Custom Status Message'),
          admin: {
            description: ta('Override the default status banner message (leave empty to use automatic)'),
          },
        },
      ],
    },
    {
      type: 'collapsible',
      label: ta('Situation overview'),
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'lagebildVariant',
          type: 'select',
          label: ta('Display'),
          defaultValue: 'off',
          options: [
            { label: ta('Variant C (simple list)'), value: 'off' },
            { label: ta('Variant A (tiles, services with bars on click)'), value: 'a' },
            { label: ta('Variant B (tiles with own bar)'), value: 'b' },
            { label: ta('Both (for testing)'), value: 'both' },
          ],
          admin: {
            description: ta(
              'Layout of the start page. Variants A and B show the situation overview on the left and boxes for disruptions and maintenance on the right. Variant A shows tiles, a click shows the services with bars. Variant B shows a small bar in every tile. "Both" displays both variants one after the other to compare them. Variant C is the simple list without situation overview. The three settings below apply to A, B and "Both" only.',
            ),
          },
        },
        {
          name: 'lagebildPeriodDays',
          type: 'select',
          label: ta('Look-back period'),
          defaultValue: '14',
          options: [
            { label: ta('14 days'), value: '14' },
            { label: ta('Month (30 days)'), value: '30' },
            { label: ta('Quarter (90 days)'), value: '90' },
            { label: ta('Half year (180 days)'), value: '180' },
            { label: ta('Year (365 days)'), value: '365' },
          ],
          admin: {
            description: ta(
              'Default look-back of the situation overview: restrictions list and availability per service. Visitors can change it on the status page.',
            ),
          },
        },
        {
          name: 'lagebildBarHours',
          type: 'select',
          label: ta('Bar period'),
          defaultValue: '12',
          options: [
            { label: ta('12 hours (5 minutes per stroke)'), value: '12' },
            { label: ta('24 hours (10 minutes per stroke)'), value: '24' },
          ],
          admin: {
            description: ta(
              'Default period of the bars in the situation overview. Visitors can change it on the status page.',
            ),
          },
        },
        {
          name: 'statusBoxEntries',
          type: 'number',
          label: ta('Entries per box'),
          defaultValue: 3,
          min: 1,
          max: 10,
          admin: {
            condition: (data) => data?.lagebildVariant !== 'off',
            description: ta(
              'How many disruptions and maintenances each box on the start page shows. The rest is behind "show more".',
            ),
          },
        },
        {
          name: 'statusBoxContent',
          type: 'select',
          label: ta('Content of the boxes'),
          defaultValue: 'full',
          options: [
            { label: ta('With services and latest update'), value: 'full' },
            { label: ta('Title and time only'), value: 'compact' },
          ],
          admin: {
            condition: (data) => data?.lagebildVariant !== 'off',
          },
        },
        {
          name: 'statusBoxesPlacement',
          type: 'select',
          label: ta('Boxes on narrow screens'),
          defaultValue: 'before',
          options: [
            { label: ta('Before the situation overview'), value: 'before' },
            { label: ta('After the situation overview'), value: 'after' },
          ],
          admin: {
            condition: (data) => data?.lagebildVariant !== 'off',
          },
        },
        {
          name: 'availabilityTarget',
          type: 'number',
          label: ta('Availability target (%)'),
          defaultValue: 99,
          min: 0,
          max: 100,
          admin: {
            description: ta(
              'Applies to all services until a group or a service has its own value. Used by the availability report.',
            ),
          },
        },
        {
          name: 'classificationRules',
          type: 'array',
          label: ta('Classify old incidents automatically'),
          labels: { singular: ta('Rule'), plural: ta('Rules') },
          admin: {
            description: ta(
              'For the time before the status log, these rules read the title and the text of an old incident and decide how it counts in the availability report. They apply from top to bottom, the first matching rule decides. Upper and lower case do not matter. A classification set by hand on an incident always applies. New incidents are not affected. Changed rules take effect when the reconstruction is started under "Maintain the status log". Without rules every old incident counts as a partial outage that is not clearly classified.',
            ),
            initCollapsed: false,
          },
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'field',
                  type: 'select',
                  required: true,
                  defaultValue: 'title',
                  label: ta('Searches in'),
                  options: [
                    { label: ta('Title'), value: 'title' },
                    { label: ta('Text of the updates'), value: 'updates' },
                  ],
                },
                {
                  name: 'match',
                  type: 'select',
                  required: true,
                  defaultValue: 'contains',
                  label: ta('Condition'),
                  options: [
                    { label: ta('contains'), value: 'contains' },
                    { label: ta('starts with'), value: 'starts' },
                  ],
                },
                {
                  name: 'classification',
                  type: 'select',
                  required: true,
                  defaultValue: 'partial',
                  label: ta('Counts as'),
                  options: [
                    { label: ta('Maintenance'), value: 'maintenance' },
                    { label: ta('No impact'), value: 'none' },
                    { label: ta('Degraded Performance'), value: 'degraded' },
                    { label: ta('Partial Outage'), value: 'partial' },
                    { label: ta('Major Outage'), value: 'major' },
                  ],
                },
              ],
            },
            {
              name: 'words',
              type: 'text',
              required: true,
              label: ta('Words'),
              admin: {
                description: ta('Words or phrases, separated by commas. One of them is enough.'),
              },
            },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: ta('Maintenance'),
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'maintenanceTerminalRetentionHours',
          type: 'number',
          defaultValue: 24,
          min: 0,
          label: ta('Maintenance retention (hours)'),
          admin: {
            description:
              ta('How long completed and cancelled maintenances stay visible on the status page after they enter a terminal state.'),
          },
        },
      ],
    },
    {
      type: 'collapsible',
      label: ta('Localization'),
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'timezone',
          type: 'select',
          label: ta('Timezone'),
          defaultValue: 'UTC',
          options: TIMEZONE_OPTIONS.map((value) => ({ label: value, value })),
          admin: {
            description:
              ta('Timezone used for public timestamps, history weeks, and admin date pickers. Visitors see this timezone, not their own.'),
          },
        },
        {
          // Datumssprache: das Feld locale, sonst die Datumssprache von DEFAULT_LANGUAGE. Wird nicht gespeichert,
          // sondern beim Lesen berechnet, damit alle Stellen mit resolveDateTimeConfig(settings) (auch im Admin) sie bekommen.
          name: 'dateLocale',
          type: 'text',
          virtual: true,
          admin: { hidden: true, disableBulkEdit: true },
          hooks: {
            afterRead: [({ siblingData }) => (siblingData as { locale?: string | null }).locale || translatorsFor().dateLocale],
          },
        },
        {
          name: 'locale',
          type: 'text',
          label: ta('Locale'),
          admin: {
            description:
              ta('BCP 47 locale for date and time formatting (e.g. en-US, de-DE, fr-FR). Controls 12-hour vs 24-hour clocks. Empty follows the language of the server (DEFAULT_LANGUAGE).'),
          },
        },
        {
          name: 'weekStartsOn',
          type: 'select',
          label: ta('Week starts on'),
          defaultValue: 'monday',
          options: [
            { label: ta('Monday'), value: 'monday' },
            { label: ta('Sunday'), value: 'sunday' },
          ],
          admin: {
            description:
              ta('First day of the week for incident history and admin date pickers.'),
          },
        },
      ],
    },
  ],
}
