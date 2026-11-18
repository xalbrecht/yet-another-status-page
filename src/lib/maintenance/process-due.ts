import type { Payload, Where } from 'payload'
import { translatorsFor } from '@/lib/i18n/translators'
import { acquireSendLock, type SendLock } from '@/lib/report/export/send-lock'
import { sendNotificationDraft } from '@/lib/notifications/send-draft'
import { createMaintenanceNotification, formatScheduleTime, type DeferredNotification } from './notification'
import { resolveScheduledStatus, type MaintenanceStatus } from './schedule'

/**
 * Stellt fällige Wartungen um: Beginn oder Ende nach dem Zeitplan erreicht, Haken „automatisch“ gesetzt, Status noch alt.
 * Je Umstellung entsteht ein Eintrag im Verlauf der Wartung („Die Wartung hat begonnen.“), ein Benachrichtigungsentwurf, und
 * der Entwurf geht sofort an die Abonnenten. Die Umstellung läuft unter einer Sperre der Datenbank (nur ein Prozess zugleich).
 */

/** Kennung der Sperre (nur für diese Funktion vergeben, siehe SEND_LOCK_KEY). */
export const MAINTENANCE_LOCK_KEY = 7_116_002

/** Kontext der Abfragen: die Collection legt die Anzeige des Zeitplans nicht über den gespeicherten Status. */
const CONTEXT = { skipScheduleOverlay: true, skipNotificationCreation: true }

export type DueResult = {
  /** `locked`: Ein anderer Prozess stellt gerade um, nichts getan. */
  skipped: 'locked' | null
  transitioned: Array<{ id: number | string; status: MaintenanceStatus }>
  /** Umstellung gespeichert, aber Entwurf oder Versand schlug fehl (der Entwurf bleibt, falls er entstand). */
  notificationFailed: Array<number | string>
}

export type DueDeps = {
  acquireLock: (payload: Payload) => Promise<SendLock | null>
  createNotification: (payload: Payload, data: DeferredNotification) => Promise<{ id: number | string }>
  sendDraft: (payload: Payload, notificationId: string | number) => Promise<unknown>
}

export const defaultDueDeps: DueDeps = {
  acquireLock: (payload) => acquireSendLock(payload, MAINTENANCE_LOCK_KEY),
  createNotification: createMaintenanceNotification,
  sendDraft: sendNotificationDraft,
}

/** Abfrage der Kandidaten: Status offen und Beginn oder Ende erreicht, jeweils nur bei gesetztem Haken. */
export function dueMaintenanceWhere(now: number): Where {
  const iso = new Date(now).toISOString()
  return {
    and: [
      { status: { in: ['upcoming', 'in_progress'] } },
      {
        or: [
          { and: [{ autoStartOnSchedule: { equals: true } }, { scheduledStartAt: { less_than_equal: iso } }] },
          { and: [{ autoCompleteOnSchedule: { equals: true } }, { scheduledEndAt: { less_than_equal: iso } }] },
        ],
      },
    ],
  }
}

export async function processDueMaintenances(
  payload: Payload,
  now: number = Date.now(),
  deps: DueDeps = defaultDueDeps,
): Promise<DueResult> {
  const result: DueResult = { skipped: null, transitioned: [], notificationFailed: [] }
  const lock = await deps.acquireLock(payload)
  if (!lock) return { ...result, skipped: 'locked' }
  try {
    const candidates = await payload.find({
      collection: 'maintenances',
      where: dueMaintenanceWhere(now),
      depth: 0,
      pagination: false,
      context: CONTEXT,
    })
    const { t } = translatorsFor()
    const settings = await payload.findGlobal({ slug: 'settings' })

    for (const doc of candidates.docs) {
      // Der Zustand wurde eben frisch gelesen: gilt der Übergang noch?
      const status = resolveScheduledStatus(doc, new Date(now))
      if (!status || status === 'upcoming' || status === 'cancelled') continue

      const message = status === 'completed' ? t('maintenance.autoCompleted') : t('maintenance.autoStarted')
      const updates = [...(doc.updates ?? []), { status, message, createdAt: new Date(now).toISOString() }]
      try {
        await payload.update({ collection: 'maintenances', id: doc.id, data: { status, updates }, depth: 0, context: CONTEXT })
      } catch (error) {
        console.error(`[Maintenances] Umstellung der Wartung ${doc.id} fehlgeschlagen:`, error)
        continue
      }
      result.transitioned.push({ id: doc.id, status })

      try {
        const notification = await deps.createNotification(payload, {
          docId: doc.id,
          title: doc.title || 'Maintenance',
          shortId: doc.shortId || '',
          statusLabel: t(`maintenance.${status}`),
          isUpdate: true,
          updateIndex: updates.length - 1,
          startTimeStr: formatScheduleTime(doc.scheduledStartAt, settings),
          endTimeStr: formatScheduleTime(doc.scheduledEndAt, settings),
          duration: doc.duration ?? undefined,
          message,
        })
        await deps.sendDraft(payload, notification.id)
      } catch (error) {
        console.error(`[Maintenances] Meldung zur Wartung ${doc.id} fehlgeschlagen:`, error)
        result.notificationFailed.push(doc.id)
      }
    }
    return result
  } finally {
    await lock.release()
  }
}
