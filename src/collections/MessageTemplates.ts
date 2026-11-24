import type { CollectionConfig } from 'payload'
import { rolesAccess } from '@/lib/access'
import { ta } from '@/lib/i18n/admin'
import { incidentStatusOptions } from './Incidents'
import { maintenanceStatusOptions } from './Maintenances'
import { checkTemplateText, isStatusOfKind, NTFY_TEXT_MAX_LENGTH, SMS_TEXT_MAX_LENGTH, type TemplateKind } from '@/lib/message-templates'

export { NTFY_TEXT_MAX_LENGTH, SMS_TEXT_MAX_LENGTH }

const kindOf = (data: Record<string, unknown> | undefined): TemplateKind => (data?.kind === 'maintenance' ? 'maintenance' : 'incident')

/** Übersetzt das Ergebnis von `checkTemplateText` in eine Meldung am Feld. */
function textValidator(required: boolean, maxLength?: number) {
  return (value: string | null | undefined, { siblingData }: { siblingData?: Record<string, unknown> }): true | string => {
    const result = checkTemplateText(value, { required, kind: kindOf(siblingData), maxLength })
    if (result.ok) return true
    if (result.problem === 'required') return ta('This field is required.')
    if (result.problem === 'too-long') return ta('The text is longer than {max} characters.').replace('{max}', String(result.max))
    return ta('Unknown placeholder: {names}. Allowed for this type: {allowed}.')
      .replace('{names}', result.names.map((name) => `{{${name}}}`).join(', '))
      .replace('{allowed}', result.allowed.map((name) => `{{${name}}}`).join(', '))
  }
}

/**
 * Vorlagen für Meldungen: Titel und Texte für Störungen und Wartungen, je Aktualisierungsstatus. Sie liegen getrennt von den
 * echten Meldungen, deshalb löst eine Vorlage keinen Hook aus (keine Benachrichtigung, kein Dienstzustand, kein Zeitplan)
 * und taucht auf keiner öffentlichen Seite auf. Lesen und Schreiben nur für Angemeldete.
 */
export const MessageTemplates: CollectionConfig = {
  slug: 'message-templates',
  labels: { singular: ta('Template'), plural: ta('Templates') },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'kind', 'status', 'impact', 'updatedAt'],
    group: ta('Status'),
    description: ta(
      'Texts for incidents and maintenances. When you report something, you choose a template and the placeholders are filled in. Only signed-in users can see templates.',
    ),
  },
  access: {
    read: rolesAccess(['admin', 'servicedesk']),
    create: rolesAccess(['admin', 'servicedesk']),
    update: rolesAccess(['admin', 'servicedesk']),
    delete: rolesAccess(['admin', 'servicedesk']),
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        // Die Auswirkung gibt es nur bei Störungen
        if (data?.kind === 'maintenance') data.impact = null
        return data
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: ta('Name'),
      admin: { description: ta('How the template appears in the list, for example "Investigating: partial outage".') },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'kind',
          type: 'select',
          required: true,
          defaultValue: 'incident',
          label: ta('Type'),
          options: [
            { label: ta('Incident'), value: 'incident' },
            { label: ta('Maintenance'), value: 'maintenance' },
          ],
          admin: { width: '33%' },
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          label: ta('Update status'),
          // Dieselben Listen wie bei den Störungen und Wartungen: Ein neuer Status gilt automatisch auch für Vorlagen
          options: [...incidentStatusOptions, ...maintenanceStatusOptions],
          validate: (value: string | null | undefined, { siblingData }: { siblingData?: Record<string, unknown> }) => {
            if (!value) return ta('This field is required.')
            return isStatusOfKind(kindOf(siblingData), value) ? true : ta('This status does not belong to the chosen type.')
          },
          admin: {
            width: '33%',
            description: ta('The status of the update for which the template is meant.'),
          },
        },
        {
          name: 'impact',
          type: 'select',
          label: ta('Preset impact'),
          options: [
            { label: ta('Degraded Performance'), value: 'degraded' },
            { label: ta('Partial Outage'), value: 'partial' },
            { label: ta('Major Outage'), value: 'major' },
          ],
          admin: {
            width: '33%',
            condition: (data) => data?.kind !== 'maintenance',
            description: ta('Optional. Preselects the impact when this template is chosen.'),
          },
        },
      ],
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      label: ta('Title'),
      validate: textValidator(true),
      admin: {
        description: ta(
          'Title of the incident or maintenance. Placeholders: {{services}} (the affected services as a list), {{group}} (the group), {{impact}} (the impact, incidents only), {{start}} and {{end}} (maintenances only), {{link}} (the address of the message).',
        ),
      },
    },
    {
      name: 'body',
      type: 'textarea',
      required: true,
      label: ta('Text'),
      validate: textValidator(true),
      admin: {
        rows: 6,
        description: ta(
          'Text for the status page and the email. Word it so that it fits one service and several, for example "Affected: {{services}}".',
        ),
      },
    },
    {
      name: 'smsBody',
      type: 'textarea',
      label: ta('SMS text'),
      maxLength: SMS_TEXT_MAX_LENGTH,
      validate: textValidator(false, SMS_TEXT_MAX_LENGTH),
      admin: {
        rows: 3,
        description: ta('Optional. A short text for SMS (up to 320 characters, longer texts are cut). The same placeholders as above.'),
      },
    },
    {
      name: 'ntfyBody',
      type: 'textarea',
      label: ta('ntfy text'),
      maxLength: NTFY_TEXT_MAX_LENGTH,
      validate: textValidator(false, NTFY_TEXT_MAX_LENGTH),
      admin: {
        rows: 3,
        description: ta('Optional. A short text for a push message via ntfy (up to 500 characters). The same placeholders as above.'),
      },
    },
  ],
}
