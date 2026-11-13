import type { GlobalConfig } from 'payload'
import { authenticatedOrTestWrite } from '@/lib/access'
import { TIMEZONE_OPTIONS } from '@/lib/datetime'
import { ta } from '@/lib/i18n/admin'

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
            { label: ta('Variant C (simple list)', 'Variante C (einfache Liste)'), value: 'off' },
            { label: ta('Variant A (tiles, services with bars on click)', 'Variante A (Kacheln, Dienste mit Balken beim Anklicken)'), value: 'a' },
            { label: ta('Variant B (tiles with own bar)', 'Variante B (Kacheln mit eigenem Balken)'), value: 'b' },
            { label: ta('Both (for testing)'), value: 'both' },
          ],
          admin: {
            description: ta(
              'Layout of the start page. Variants A and B show the situation overview on the left and boxes for disruptions and maintenance on the right. Variant A shows tiles, a click shows the services with bars. Variant B shows a small bar in every tile. "Both" displays both variants one after the other to compare them. Variant C is the simple list without situation overview. The three settings below apply to A, B and "Both" only.',
              'Aufbau der Startseite. Die Varianten A und B zeigen links das Lagebild und rechts Boxen für Störungen und Wartungen. Variante A zeigt Kacheln, ein Klick zeigt die Dienste mit Balken. Variante B zeigt einen kleinen Balken in jeder Kachel. „Beide“ zeigt beide Varianten nacheinander zum Vergleichen. Variante C ist die einfache Liste ohne Lagebild. Die drei Einstellungen darunter gelten nur für A, B und „Beide“.',
            ),
          },
        },
        {
          name: 'lagebildPeriodDays',
          type: 'select',
          label: ta('Look-back period', 'Rückschau'),
          defaultValue: '14',
          options: [
            { label: ta('14 days', '14 Tage'), value: '14' },
            { label: ta('Month (30 days)', 'Monat (30 Tage)'), value: '30' },
            { label: ta('Quarter (90 days)', 'Quartal (90 Tage)'), value: '90' },
            { label: ta('Half year (180 days)', 'Halbjahr (180 Tage)'), value: '180' },
            { label: ta('Year (365 days)', 'Jahr (365 Tage)'), value: '365' },
          ],
          admin: {
            description: ta(
              'Default look-back of the situation overview: restrictions list and availability per service. Visitors can change it on the status page.',
              'Vorgabe für die Rückschau im Lagebild: Liste der Einschränkungen und Verfügbarkeit je Dienst. Besucher können sie auf der Statusseite ändern.',
            ),
          },
        },
        {
          name: 'lagebildBarHours',
          type: 'select',
          label: ta('Bar period', 'Zeitraum der Balken'),
          defaultValue: '12',
          options: [
            { label: ta('12 hours (5 minutes per stroke)', '12 Stunden (5 Minuten je Strich)'), value: '12' },
            { label: ta('24 hours (10 minutes per stroke)', '24 Stunden (10 Minuten je Strich)'), value: '24' },
          ],
          admin: {
            description: ta(
              'Default period of the bars in the situation overview. Visitors can change it on the status page.',
              'Vorgabe für den Zeitraum der Balken im Lagebild. Besucher können ihn auf der Statusseite ändern.',
            ),
          },
        },
        {
          name: 'statusBoxEntries',
          type: 'number',
          label: ta('Entries per box', 'Einträge je Box'),
          defaultValue: 3,
          min: 1,
          max: 10,
          admin: {
            condition: (data) => data?.lagebildVariant !== 'off',
            description: ta(
              'How many disruptions and maintenances each box on the start page shows. The rest is behind "show more".',
              'Wie viele Störungen und Wartungen jede Box auf der Startseite zeigt. Der Rest steht hinter „weitere anzeigen“.',
            ),
          },
        },
        {
          name: 'statusBoxContent',
          type: 'select',
          label: ta('Content of the boxes', 'Inhalt der Boxen'),
          defaultValue: 'full',
          options: [
            { label: ta('With services and latest update', 'Mit Diensten und letztem Stand'), value: 'full' },
            { label: ta('Title and time only', 'Nur Titel und Zeit'), value: 'compact' },
          ],
          admin: {
            condition: (data) => data?.lagebildVariant !== 'off',
          },
        },
        {
          name: 'statusBoxesPlacement',
          type: 'select',
          label: ta('Boxes on narrow screens', 'Boxen auf schmalen Bildschirmen'),
          defaultValue: 'before',
          options: [
            { label: ta('Before the situation overview', 'Vor dem Lagebild'), value: 'before' },
            { label: ta('After the situation overview', 'Nach dem Lagebild'), value: 'after' },
          ],
          admin: {
            condition: (data) => data?.lagebildVariant !== 'off',
          },
        },
        {
          name: 'availabilityTarget',
          type: 'number',
          label: ta('Availability target (%)', 'Zielwert Verfügbarkeit (%)'),
          defaultValue: 99,
          min: 0,
          max: 100,
          admin: {
            description: ta(
              'Applies to all services until a group or a service has its own value. Used by the availability report.',
              'Gilt für alle Dienste, bis eine Gruppe oder ein Dienst einen eigenen Wert hat. Grundlage des Verfügbarkeitsberichts.',
            ),
          },
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
              'How long completed and cancelled maintenances stay visible on the status page after they enter a terminal state.',
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
              'Timezone used for public timestamps, history weeks, and admin date pickers. Visitors see this timezone, not their own.',
          },
        },
        {
          name: 'locale',
          type: 'text',
          label: ta('Locale'),
          defaultValue: 'en-US',
          admin: {
            description:
              'BCP 47 locale for date and time formatting (e.g. en-US, de-DE, fr-FR). Controls 12-hour vs 24-hour clocks.',
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
              'First day of the week for incident history and admin date pickers.',
          },
        },
      ],
    },
  ],
}
