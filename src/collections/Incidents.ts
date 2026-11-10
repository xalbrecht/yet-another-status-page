import type { CollectionConfig } from 'payload'
import { t } from '@/lib/i18n'
import { generateShortId } from '@/lib/shortId'
import { standardAccess } from '@/lib/access'
import { getServerUrl } from '@/lib/utils'
import { localizedDateAdmin } from '@/lib/localizedDateAdmin'
import { ta } from '@/lib/i18n/admin'

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
      const template = smsSettings.templateIncidentUpdate || '[{{siteName}}] 📢 {{title}} | {{status}} | {{message}} | {{url}}'
      smsBody = interpolateTemplate(template, templateVars)
      emailBody = `${t('notif.status')}: ${data.statusLabel}\n\n${data.message}\n\n${t('notif.viewDetails')}: ${url}`
    }
    
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
        smsBody,
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
  labels: { singular: ta('Incident', 'Störung'), plural: ta('Incidents', 'Störungen') },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'shortId', 'createdAt'],
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
      name: 'updates',
      type: 'array',
      required: true,
      minRows: 1,
      label: ta('Updates'),
      labels: { singular: ta('Update', 'Aktualisierung'), plural: ta('Updates') },
      admin: {
        description: ta('Timeline of updates for this incident. At least one update is required.'),
      },
      fields: [
        {
          name: 'status',
          label: ta('Status', 'Status'),
          type: 'select',
          required: true,
          options: [...incidentStatusOptions],
          admin: {
            description: ta('Status at the time of this update'),
          },
        },
        {
          name: 'message',
          label: ta('Message', 'Nachricht'),
          type: 'textarea',
          required: true,
          admin: {
            description: ta('Update message'),
          },
        },
        {
          name: 'createdAt',
          label: ta('Created At', 'Erstellt am'),
          type: 'date',
          required: true,
          defaultValue: () => new Date().toISOString(),
          admin: localizedDateAdmin({
            description: ta('When this update was posted'),
          }),
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        data = data || {}
        
        // Always generate a new shortId on create (including duplicates)
        if (operation === 'create') {
          data.shortId = generateShortId(8)
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
      async ({ doc, operation, previousDoc, req }) => {
        // Skip if triggered by our own update to prevent loops
        if (req.context?.skipNotificationCreation) {
          return doc
        }

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
