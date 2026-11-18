import type { Payload } from 'payload'
import { getTranslators } from '@/lib/i18n/server'
import { getServerUrl } from '@/lib/utils'
import type { Notification, Incident, Maintenance } from '@/payload-types'

/** Ergebnis von `sendNotificationDraft`. Die Gründe einer Ablehnung bildet die Route auf Statuscodes und Texte ab. */
export type SendDraftResult =
  | { ok: true; totalRecipients: number; status: string | undefined }
  | { ok: false; reason: 'not-found' | 'already-sent' | 'busy' }

/**
 * Versendet einen Benachrichtigungsentwurf (oder wiederholt einen fehlgeschlagenen): Status auf „geplant“, Auftrag
 * einreihen, ausführen und auf das Ergebnis warten. Gemeinsam genutzt von der Route „Senden“ und vom Zeitgeber der Wartungen.
 */
export async function sendNotificationDraft(payload: Payload, notificationId: string | number): Promise<SendDraftResult> {
  const { t } = getTranslators()

  const notification = (await payload.findByID({ collection: 'notifications', id: notificationId })) as Notification | null
  if (!notification) return { ok: false, reason: 'not-found' }
  if (notification.status === 'sent') return { ok: false, reason: 'already-sent' }
  // Erneuter Versuch ist aus „fehlgeschlagen“ erlaubt
  if (notification.status !== 'draft' && notification.status !== 'failed') return { ok: false, reason: 'busy' }

  // Verweis auf die Störung oder Wartung für den Permalink
  const siteUrl = getServerUrl()
  let itemUrl = siteUrl
  let itemTitle = t('mail.defaultTitle')

  if (notification.relatedIncident) {
    const incident =
      typeof notification.relatedIncident === 'object'
        ? notification.relatedIncident
        : ((await payload.findByID({ collection: 'incidents', id: notification.relatedIncident })) as Incident)
    if (incident) {
      itemTitle = incident.title
      if (incident.shortId) itemUrl = `${siteUrl}/i/${incident.shortId}`
    }
  } else if (notification.relatedMaintenance) {
    const maintenance =
      typeof notification.relatedMaintenance === 'object'
        ? notification.relatedMaintenance
        : ((await payload.findByID({ collection: 'maintenances', id: notification.relatedMaintenance })) as Maintenance)
    if (maintenance) {
      itemTitle = maintenance.title
      if (maintenance.shortId) itemUrl = `${siteUrl}/m/${maintenance.shortId}`
    }
  }

  await payload.update({ collection: 'notifications', id: notificationId, data: { status: 'scheduled' } })

  await payload.jobs.queue({
    task: 'sendNotificationFromCollection',
    input: {
      notificationId: String(notificationId),
      channel: notification.channel || 'email',
      subject: notification.subject || undefined,
      emailBody: notification.emailBody || undefined,
      smsBody: notification.smsBody || undefined,
      itemTitle,
      itemUrl,
    },
  })

  // Ausführen und auf den Abschluss warten
  await payload.jobs.run()

  const updated = (await payload.findByID({ collection: 'notifications', id: notificationId })) as Notification
  return { ok: true, totalRecipients: updated?.recipientCount || 0, status: updated?.status }
}
