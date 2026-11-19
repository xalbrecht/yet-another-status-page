import type { CollectionConfig } from 'payload'
import { translatorsFor } from '@/lib/i18n/translators'
import { generateShortId } from '@/lib/shortId'
import { authenticatedOrTestWriteField, standardAccess } from '@/lib/access'
import { NTFY_TEXT_MAX_LENGTH, renderTemplate, SMS_TEXT_MAX_LENGTH } from '@/lib/template-text'
import { getServerUrl } from '@/lib/utils'
import { localizedDateAdmin } from '@/lib/localizedDateAdmin'
import { ta } from '@/lib/i18n/admin'
import { activeServicesFilterOptions, validateActiveServices } from '@/lib/affected-services'
import { invalidateLagebild } from '@/lib/lagebild-invalidate'
import { resolveScheduledStatus } from '@/lib/maintenance/schedule'
import { triggerDueProcessing } from '@/lib/maintenance/trigger'
import { createMaintenanceNotification, formatScheduleTime, type DeferredNotification } from '@/lib/maintenance/notification'

import type { MaintenanceStatus } from '@/lib/maintenance/schedule'
export type { MaintenanceStatus }

export const maintenanceStatusOptions = [
  { label: ta('Upcoming'), value: 'upcoming' },
  { label: ta('In Progress'), value: 'in_progress' },
  { label: ta('Completed'), value: 'completed' },
  { label: ta('Cancelled'), value: 'cancelled' },
] as const

/** Text, SMS- und ntfy-Text der ersten Aktualisierung (leer, wenn es keine gibt). */
function firstUpdateTexts(updates: unknown): Pick<DeferredNotification, 'message' | 'smsBody' | 'ntfyBody'> {
  const first = Array.isArray(updates) ? (updates[0] as { message?: string | null; smsBody?: string | null; ntfyBody?: string | null } | undefined) : undefined
  if (!first?.message) return {}
  return { message: first.message, smsBody: first.smsBody ?? undefined, ntfyBody: first.ntfyBody ?? undefined }
}

// Entwurf nach dem Ende der Transaktion anlegen, auf einer frischen Payload-Instanz
async function createMaintenanceNotificationDeferred(data: DeferredNotification) {
  try {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    const payload = await getPayload({ config })
    return await createMaintenanceNotification(payload, data)
  } catch (error) {
    console.error('[Maintenances] Failed to create notification:', error)
  }
}

export const Maintenances: CollectionConfig = {
  slug: 'maintenances',
  labels: { singular: ta('Maintenance'), plural: ta('Maintenances') },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'shortId', 'status', 'scheduledStartAt', 'updatedAt'],
    components: {
      // Knopf „Neu erstellen mit Vorlage“ im Kopfbereich der Liste, unter dem Titel
      Description: '@/components/admin/incident-wizard/NewWithTemplateButton#NewMaintenanceWithTemplateButton',
    },
    group: ta('Status'),
  },
  access: standardAccess,
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: ta('Maintenance Title'),
      admin: {
        description: ta('A brief description of the maintenance (e.g., "Database Migration")'),
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
      name: 'cancelledAt',
      type: 'date',
      label: ta('Cancelled At'),
      index: true,
      admin: localizedDateAdmin({
        position: 'sidebar',
        description: ta('When the maintenance was cancelled'),
        readOnly: true,
      }),
    },
    {
      name: 'completedAt',
      type: 'date',
      label: ta('Completed At'),
      index: true,
      admin: localizedDateAdmin({
        position: 'sidebar',
        description: ta('When the maintenance was completed'),
        readOnly: true,
      }),
    },
    {
      name: 'description',
      type: 'richText',
      label: ta('Description'),
      admin: {
        description: ta('Detailed description of the maintenance work'),
      },
      // Uses global editor config with FixedToolbarFeature
    },
    {
      name: 'affectedServices',
      type: 'relationship',
      relationTo: 'services',
      hasMany: true,
      filterOptions: activeServicesFilterOptions,
      validate: validateActiveServices('maintenances'),
      label: ta('Affected Services'),
      admin: {
        description: ta('Services that will be affected by this maintenance'),
      },
    },
    {
      name: 'scheduledStartAt',
      type: 'date',
      required: true,
      label: ta('Scheduled Start'),
      admin: localizedDateAdmin({
        description: ta('When the maintenance is scheduled to start'),
      }),
    },
    {
      name: 'scheduledEndAt',
      type: 'date',
      label: ta('Scheduled End'),
      admin: localizedDateAdmin({
        description: ta('When the maintenance is expected to end'),
      }),
    },
    {
      // Ohne Vorgabe: eine Wartung ohne Entscheidung ist nicht „im Fenster“. Das Pflichtfeld verhindert, dass der Bericht raten muss.
      name: 'maintenanceKind',
      type: 'select',
      required: true,
      label: ta('Maintenance type'),
      options: [
        { label: ta('Within the maintenance window (SLA)'), value: 'sla' },
        { label: ta('Additional maintenance'), value: 'additional' },
      ],
      index: true,
      admin: {
        description: ta('Decides how the availability report counts this maintenance.'),
      },
    },
    {
      name: 'duration',
      type: 'text',
      label: ta('Duration'),
      admin: {
        description: ta('Human-readable duration (e.g., "~2 hours")'),
      },
    },
    {
      name: 'status',
      label: ta('Status'),
      type: 'select',
      required: true,
      defaultValue: 'upcoming',
      options: [...maintenanceStatusOptions],
      index: true,
      admin: {
        description:
          ta('Derived from the latest entry in Updates, or auto-transitioned by schedule. Post an update to change status.'),
        readOnly: true,
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'autoStartOnSchedule',
          type: 'checkbox',
          defaultValue: true,
          label: ta('Auto-start on schedule'),
          admin: {
            description: ta('Sets "In Progress" when the start time is reached and notifies the subscribers right away'),
            width: '50%',
          },
        },
        {
          name: 'autoCompleteOnSchedule',
          type: 'checkbox',
          defaultValue: true,
          label: ta('Auto-complete on schedule'),
          admin: {
            description: ta('Sets "Completed" when the end time is reached and notifies the subscribers right away'),
            width: '50%',
          },
        },
      ],
    },
    {
      name: 'updates',
      type: 'array',
      label: ta('Updates'),
      labels: { singular: ta('Update'), plural: ta('Updates') },
      admin: {
        description: ta('Optional timeline of updates for this maintenance'),
      },
      fields: [
        {
          name: 'status',
          label: ta('Status'),
          type: 'select',
          required: true,
          options: [...maintenanceStatusOptions],
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
            components: {
              // Auswahl „Vorlage einfügen“ über dem Feld, nur bei neuen Aktualisierungen
              beforeInput: ['@/components/admin/update-template/UpdateTemplatePicker#UpdateTemplatePicker'],
            },
          },
        },
        {
          name: 'createdAt',
          label: ta('Created At'),
          type: 'date',
          required: true,
          defaultValue: () => new Date().toISOString(),
          admin: localizedDateAdmin({
            description: ta('When this update was posted. The availability report reads the start and end of a maintenance from the updates "In Progress" and "Completed". When adding them later, enter the actual times.'),
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
    beforeChange: [
      ({ data, operation, originalDoc, req }) => {
        data = data || {}

        if (operation === 'create') {
          data.shortId = generateShortId(8)
        }

        // `{{link}}` in den Texten der Aktualisierungen (aus einer Vorlage) durch die Adresse der Wartung ersetzen. Die Kennung
        // besteht erst jetzt, deshalb geschieht es hier und nicht in der Vorlage.
        const shortIdForLink = (data.shortId as string | undefined) ?? (originalDoc?.shortId as string | undefined)
        if (shortIdForLink && Array.isArray(data.updates)) {
          const values = { link: `${getServerUrl()}/m/${shortIdForLink}` }
          for (const update of data.updates as Array<Record<string, unknown>>) {
            for (const key of ['message', 'smsBody', 'ntfyBody']) {
              if (typeof update[key] === 'string') update[key] = renderTemplate(update[key] as string, values)
            }
          }
        }

        // Sync top-level status from the latest update, except when the schedule
        // auto-transition is writing status directly without a corresponding update.
        if (!req?.context?.skipAutoStatusUpdate) {
          const updates = data.updates as Array<{ status?: string }> | undefined
          if (updates && updates.length > 0) {
            const latest = updates[updates.length - 1]
            if (latest?.status) data.status = latest.status
          }
        }

        // Apply the schedule transition on write too, so a maintenance saved with an
        // already-elapsed start or end time is stored with the correct status right away.
        const scheduledStatus = resolveScheduledStatus({ ...originalDoc, ...data })
        if (scheduledStatus) {
          data.status = scheduledStatus
        }

        if (data.status === 'cancelled' && !data.cancelledAt) {
          data.cancelledAt = new Date().toISOString()
        } else if (data.status !== 'cancelled') {
          data.cancelledAt = null
        }

        if (data.status === 'completed' && !data.completedAt) {
          data.completedAt = new Date().toISOString()
        } else if (data.status !== 'completed') {
          data.completedAt = null
        }

        return data
      },
    ],
    afterRead: [
      ({ doc, req }) => {
        if (!doc?.id) return doc
        // Die Umstellung selbst liest den gespeicherten Status
        if (req?.context?.skipScheduleOverlay) return doc

        // Zeigt den Zeitplan, der seit dem letzten Schreiben abgelaufen ist: Der Leser sieht den umgestellten Status.
        // Gespeichert wird die Umstellung vom Zeitgeber (src/lib/maintenance/timer.ts), hier nur als Auffangnetz angestoßen.
        const newStatus = resolveScheduledStatus(doc)
        if (!newStatus) return doc

        triggerDueProcessing()
        return { ...doc, status: newStatus }
      },
    ],
    afterDelete: [
      // Titel und Verknüpfung stehen im zwischengespeicherten Lagebild
      ({ doc }) => {
        invalidateLagebild()
        return doc
      },
    ],
    afterChange: [
      // Titel und Verknüpfung stehen im zwischengespeicherten Lagebild
      ({ doc }) => {
        invalidateLagebild()
        return doc
      },
      async ({ doc, operation, previousDoc, req }) => {
        // Skip if triggered by auto-status update or our own update
        if (req.context?.skipAutoStatusUpdate || req.context?.skipNotificationCreation) {
          return doc
        }

        const settings = await req.payload.findGlobal({ slug: 'settings' })
        const { t } = translatorsFor()
        const statusLabels: Record<string, string> = {
          upcoming: t('maintenance.upcoming'),
          in_progress: t('maintenance.in_progress'),
          completed: t('maintenance.completed'),
          cancelled: t('maintenance.cancelled'),
        }
        const title = doc.title || 'Maintenance'
        const shortId = doc.shortId || ''
        const statusLabel = statusLabels[doc.status] || doc.status || 'Update'
        const startTimeStr = formatScheduleTime(doc.scheduledStartAt, settings)
        const endTimeStr = formatScheduleTime(doc.scheduledEndAt, settings)

        // Auto-create notification on new maintenance creation
        // Use setImmediate to defer until after the current transaction commits
        if (operation === 'create') {
          const notificationData: DeferredNotification = {
            docId: doc.id,
            title,
            shortId,
            statusLabel,
            isUpdate: false,
            updateIndex: -1,
            startTimeStr,
            endTimeStr,
            duration: doc.duration,
            // Eine Wartung aus einer Vorlage trägt ihre Ankündigung als erste Aktualisierung: Text und Kurztexte gehören in den Entwurf
            ...firstUpdateTexts(doc.updates),
          }
          
          // Defer execution to after transaction commits
          setImmediate(() => {
            createMaintenanceNotificationDeferred(notificationData).catch(console.error)
          })
          return doc
        }

        // Auto-create notifications for new updates
        const currentUpdates = doc.updates || []
        const previousUpdates = previousDoc?.updates || []

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
              isUpdate: true,
              updateIndex: index,
              startTimeStr,
              endTimeStr,
              duration: doc.duration,
              message: update.message,
              smsBody: update.smsBody ?? undefined,
              ntfyBody: update.ntfyBody ?? undefined,
            }
            
            // Defer execution to after transaction commits
            setImmediate(() => {
              createMaintenanceNotificationDeferred(notificationData).catch(console.error)
            })
          }
        }

        return doc
      },
    ],
  },
}
