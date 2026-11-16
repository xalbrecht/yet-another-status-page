import type { CollectionConfig } from 'payload'
import { translatorsFor } from '@/lib/i18n/translators'
import { generateShortId } from '@/lib/shortId'
import { authenticatedOrTestWriteField, standardAccess } from '@/lib/access'
import { NTFY_TEXT_MAX_LENGTH, renderTemplate, SMS_TEXT_MAX_LENGTH } from '@/lib/template-text'
import { getServerUrl } from '@/lib/utils'
import { localizedDateAdmin } from '@/lib/localizedDateAdmin'
import { invalidateLagebild } from '@/lib/lagebild-invalidate'
import { ta } from '@/lib/i18n/admin'
import { syncServiceStatusesFromIncidents, uniqueServiceIds } from '@/lib/service-status-sync'

export const incidentStatusOptions = [
  { label: ta('Investigating'), value: 'investigating' },
  { label: ta('Identified'), value: 'identified' },
  { label: ta('Monitoring'), value: 'monitoring' },
  { label: ta('Resolved'), value: 'resolved' },
] as const

export type IncidentStatus = (typeof incidentStatusOptions)[number]['value']

// Deferred notification creation data
interface DeferredNotification {
  docId: number | string
  title: string
  shortId: string
  statusLabel: string
  isInitial: boolean
  updateIndex: number
  message: string
  /** Eigener SMS- und ntfy-Text der Aktualisierung (aus einer Vorlage), sonst leer */
  smsBody?: string | null
  ntfyBody?: string | null
}

// Helper to interpolate template placeholders
function interpolateTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '')
}

// Helper to create notification drafts for incidents (deferred execution)
async function createIncidentNotificationDeferred(data: DeferredNotification) {
  try {
    // Import payload dynamically to get a fresh instance outside the transaction
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    const payload = await getPayload({ config })
    
    // Fetch settings
    const settings = await payload.findGlobal({ slug: 'settings' })
    const smsSettings = await payload.findGlobal({ slug: 'sms-settings' })
    const { t } = translatorsFor()
    const siteName = settings.siteName || 'Status'
    const siteUrl = getServerUrl()
    
    // Get max lengths from SMS settings
    const titleMaxLength = smsSettings.templateTitleMaxLength || 50
    const messageMaxLength = smsSettings.templateMessageMaxLength || 100
    
    // Truncate title and message for SMS
    const truncatedTitle = data.title.length > titleMaxLength
      ? data.title.substring(0, titleMaxLength - 3) + '...'
      : data.title
    
    const truncatedMessage = data.message.length > messageMaxLength 
      ? data.message.substring(0, messageMaxLength - 3) + '...' 
      : data.message
    
    const url = `${siteUrl}/i/${data.shortId}`
    
    const templateVars = {
      siteName,
      title: truncatedTitle,
      status: data.statusLabel,
      message: truncatedMessage,
      url,
    }
    
    let smsBody: string
    let emailBody: string
    
    if (data.isInitial) {
      // Initial incident notification (from first update)
      const template = smsSettings.templateIncidentNew || t('notif.smsIncidentNew')
      smsBody = interpolateTemplate(template, templateVars)
      emailBody = `${t('notif.incidentNew')}\n\n${t('notif.status')}: ${data.statusLabel}\n\n${data.message}\n\n${t('notif.viewDetails')}: ${url}`
    } else {
      // Subsequent update notification
      const template = smsSettings.templateIncidentUpdate || t('notif.smsIncidentUpdate')
      smsBody = interpolateTemplate(template, templateVars)
      emailBody = `${t('notif.status')}: ${data.statusLabel}\n\n${data.message}\n\n${t('notif.viewDetails')}: ${url}`
    }
    
    // Ein eigener Text der Aktualisierung (aus einer Vorlage) ersetzt den allgemeinen SMS-Text aus den Einstellungen
    const ownSms = data.smsBody?.trim()
    const ownNtfy = data.ntfyBody?.trim()
    const notification = await payload.create({
      collection: 'notifications',
      data: {
        title: data.isInitial ? `[${t('notif.newIncident')}] ${data.title}` : `[${data.statusLabel}] ${data.title}`,
        relatedIncident: typeof data.docId === 'string' ? parseInt(data.docId, 10) : data.docId,
        updateIndex: data.updateIndex,
        channel: 'both',
        status: 'draft',
        subject: `[${data.statusLabel}] ${data.title}`,
        emailBody,
        smsBody: ownSms || smsBody,
        ...(ownNtfy ? { ntfyBody: ownNtfy } : {}),
      },
    })
    return notification
  } catch (error) {
    console.error('[Incidents] Failed to create notification:', error)
  }
}

// Helper to get status from the latest update
export function getIncidentStatus(updates: Array<{ status?: string }> | null | undefined): IncidentStatus {
  if (!updates || updates.length === 0) return 'investigating'
  // Updates are stored with newest first in display, but array order is creation order
  // The last update in the array is the most recent
  const latestUpdate = updates[updates.length - 1]
  return (latestUpdate?.status as IncidentStatus) || 'investigating'
}

// Helper to get resolvedAt from the updates (finds the first "resolved" update)
export function getIncidentResolvedAt(updates: Array<{ status?: string; createdAt?: string }> | null | undefined): string | null {
  if (!updates || updates.length === 0) return null
  // Find the first update with "resolved" status (scanning from the end for most recent)
  for (let i = updates.length - 1; i >= 0; i--) {
    if (updates[i].status === 'resolved' && updates[i].createdAt) {
      return updates[i].createdAt!
    }
  }
  return null
}

export const Incidents: CollectionConfig = {
  slug: 'incidents',
  labels: { singular: ta('Incident'), plural: ta('Incidents') },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'shortId', 'createdAt'],
    components: {
      // Knopf „Neu erstellen mit Vorlage“ im Kopfbereich der Liste, unter dem Titel
      Description: '@/components/admin/incident-wizard/NewWithTemplateButton#NewWithTemplateButton',
    },
    group: ta('Status'),
  },
  access: standardAccess,
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: ta('Incident Title'),
      admin: {
        description: ta('A brief description of the incident (e.g., "API Gateway Latency Issues")'),
      },
    },
    {
      name: 'shortId',
      type: 'text',
      unique: true,
      index: true,
      label: ta('Short ID'),
      admin: {
        position: 'sidebar',
        description: ta('Auto-generated short ID for permalinks'),
        readOnly: true,
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'investigating',
      options: [...incidentStatusOptions],
      index: true,
      label: ta('Current Status'),
      admin: {
        position: 'sidebar',
        description: ta('Automatically synced from the latest update'),
        readOnly: true,
      },
    },
    {
      name: 'resolvedAt',
      type: 'date',
      label: ta('Resolved At'),
      index: true,
      admin: localizedDateAdmin({
        position: 'sidebar',
        description: ta('When the incident was resolved'),
        readOnly: true,
      }),
    },
    {
      name: 'affectedServices',
      type: 'relationship',
      relationTo: 'services',
      hasMany: true,
      label: ta('Affected Services'),
      admin: {
        description: ta('Services affected by this incident'),
      },
    },
    {
      name: 'impact',
      type: 'select',
      required: true,
      defaultValue: 'degraded',
      label: ta('Impact on affected services'),
      options: [
        { label: ta('Degraded Performance'), value: 'degraded' },
        { label: ta('Partial Outage'), value: 'partial' },
        { label: ta('Major Outage'), value: 'major' },
      ],
      admin: {
        description: ta('Status set on the affected services while the incident is open. Once resolved, the services return to Operational.'),
      },
    },
    {
      // Einordnung für die Nachrechnung des Verlaufs vor Beginn des Statusprotokolls. Ein Wert ungleich „auto“ gilt immer.
      name: 'availabilityClass',
      type: 'select',
      defaultValue: 'auto',
      label: ta('Classification for the availability report'),
      options: [
        { label: ta('Automatic'), value: 'auto' },
        { label: ta('No impact'), value: 'none' },
        { label: ta('Degraded Performance'), value: 'degraded' },
        { label: ta('Partial Outage'), value: 'partial' },
        { label: ta('Major Outage'), value: 'major' },
      ],
      admin: {
        position: 'sidebar',
        description: ta(
          'Applies to the reconstruction of the availability history before the status log began. "Automatic" uses the rules in the site settings.',
        ),
      },
    },
    {
      name: 'updates',
      type: 'array',
      required: true,
      minRows: 1,
      label: ta('Updates'),
      labels: { singular: ta('Update'), plural: ta('Updates') },
      admin: {
        description: ta('Timeline of updates for this incident. At least one update is required.'),
      },
      fields: [
        {
          name: 'status',
          label: ta('Status'),
          type: 'select',
          required: true,
          options: [...incidentStatusOptions],
          admin: {
            description: ta('Status at the time of this update'),
          },
        },
        {
          name: 'message',
          label: ta('Message'),
          type: 'textarea',
          required: true,
          admin: {
            description: ta('Update message'),
          },
        },
        {
          name: 'createdAt',
          label: ta('Created At'),
          type: 'date',
          required: true,
          defaultValue: () => new Date().toISOString(),
          admin: localizedDateAdmin({
            description: ta('When this update was posted'),
          }),
        },
        // Texte für den Benachrichtigungsentwurf, aus einer Vorlage gesetzt. Nur Angemeldete lesen und schreiben sie,
        // sie stehen weder in der öffentlichen API noch im Formular.
        {
          name: 'smsBody',
          label: ta('SMS text'),
          type: 'textarea',
          maxLength: SMS_TEXT_MAX_LENGTH,
          admin: { hidden: true },
          access: { read: authenticatedOrTestWriteField, create: authenticatedOrTestWriteField, update: authenticatedOrTestWriteField },
        },
        {
          name: 'ntfyBody',
          label: ta('ntfy text'),
          type: 'textarea',
          maxLength: NTFY_TEXT_MAX_LENGTH,
          admin: { hidden: true },
          access: { read: authenticatedOrTestWriteField, create: authenticatedOrTestWriteField, update: authenticatedOrTestWriteField },
        },
      ],
    },
  ],
  hooks: {
    afterDelete: [
      // Titel und Verknüpfung stehen im zwischengespeicherten Lagebild
      ({ doc }) => {
        invalidateLagebild()
        return doc
      },
      async ({ doc, req }) => {
        // Die Umwandlung in Wartungen löscht gelöste Störungen, ohne Zustände von Hand zurückzusetzen
        if (req.context?.skipServiceSync) return
        // Gelöschte Störung gibt die Dienste wieder frei
        await syncServiceStatusesFromIncidents(req.payload, uniqueServiceIds(doc.affectedServices), req)
      },
    ],
    beforeChange: [
      ({ data, operation, originalDoc }) => {
        data = data || {}
        
        // Always generate a new shortId on create (including duplicates)
        if (operation === 'create') {
          data.shortId = generateShortId(8)
        }

        // `{{link}}` in Titel und Texten (aus einer Vorlage) durch die Adresse der Störung ersetzen. Die Kennung besteht erst
        // jetzt, deshalb geschieht es hier und nicht in der Vorlage.
        const shortIdForLink = (data.shortId as string | undefined) ?? (originalDoc?.shortId as string | undefined)
        if (shortIdForLink) {
          const values = { link: `${getServerUrl()}/i/${shortIdForLink}` }
          if (typeof data.title === 'string') data.title = renderTemplate(data.title, values)
          if (Array.isArray(data.updates)) {
            for (const update of data.updates as Array<Record<string, unknown>>) {
              for (const key of ['message', 'smsBody', 'ntfyBody']) {
                if (typeof update[key] === 'string') update[key] = renderTemplate(update[key] as string, values)
              }
            }
          }
        }
        
        // Sync status and resolvedAt from the latest update
        const updates = data.updates as Array<{ status?: string; createdAt?: string }> | undefined
        if (updates && updates.length > 0) {
          const latestUpdate = updates[updates.length - 1]
          data.status = latestUpdate.status || 'investigating'
          
          // Set resolvedAt if status is resolved
          if (latestUpdate.status === 'resolved') {
            data.resolvedAt = latestUpdate.createdAt || new Date().toISOString()
          } else {
            data.resolvedAt = null
          }
        }
        
        return data
      },
    ],
    afterChange: [
      // Titel und Verknüpfung stehen im zwischengespeicherten Lagebild
      ({ doc }) => {
        invalidateLagebild()
        return doc
      },
      async ({ doc, previousDoc, req }) => {
        // Zustand der betroffenen Dienste aus den offenen Störungen neu berechnen.
        // Auch Dienste, die aus der Störung entfernt wurden, werden neu bewertet.
        await syncServiceStatusesFromIncidents(
          req.payload,
          uniqueServiceIds(doc.affectedServices, previousDoc?.affectedServices),
          req,
        )
        return doc
      },
      async ({ doc, operation, previousDoc, req }) => {
        // Skip if triggered by our own update to prevent loops
        if (req.context?.skipNotificationCreation) {
          return doc
        }

        // Sprache der Einstellung (translators.ts, nicht server.ts: Letzteres importiert die Payload-Konfiguration)
        const { t } = translatorsFor()
        const statusLabels: Record<string, string> = {
          investigating: t('incident.investigating'),
          identified: t('incident.identified'),
          monitoring: t('incident.monitoring'),
          resolved: t('incident.resolved'),
        }
        const title = doc.title || 'Incident'
        const shortId = doc.shortId || ''
        const currentUpdates = doc.updates || []
        const previousUpdates = previousDoc?.updates || []

        // On create, use the first update for the initial notification
        if (operation === 'create' && currentUpdates.length > 0) {
          const firstUpdate = currentUpdates[0]
          const statusLabel = statusLabels[firstUpdate.status] || firstUpdate.status || t('incident.investigating')
          
          const notificationData: DeferredNotification = {
            docId: doc.id,
            title,
            shortId,
            statusLabel,
            isInitial: true,
            updateIndex: 0,
            message: firstUpdate.message,
            smsBody: firstUpdate.smsBody,
            ntfyBody: firstUpdate.ntfyBody,
          }
          
          // Defer execution to after transaction commits
          setImmediate(() => {
            createIncidentNotificationDeferred(notificationData).catch(console.error)
          })
          return doc
        }

        // Auto-create notifications for new updates (after the first one)
        for (let index = 0; index < currentUpdates.length; index++) {
          const update = currentUpdates[index]
          const isNewUpdate = index >= previousUpdates.length

          if (isNewUpdate && update.message) {
            const updateStatusLabel = statusLabels[update.status] || update.status || 'Update'
            const notificationData: DeferredNotification = {
              docId: doc.id,
              title,
              shortId,
              statusLabel: updateStatusLabel,
              isInitial: false,
              updateIndex: index,
              message: update.message,
              smsBody: update.smsBody,
              ntfyBody: update.ntfyBody,
            }
            
            // Defer execution to after transaction commits
            setImmediate(() => {
              createIncidentNotificationDeferred(notificationData).catch(console.error)
            })
          }
        }

        return doc
      },
    ],
  },
}
