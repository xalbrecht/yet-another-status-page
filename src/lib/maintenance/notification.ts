import type { Payload } from 'payload'
import { translatorsFor } from '@/lib/i18n/translators'
import { getServerUrl } from '@/lib/utils'
import { formatNotificationDateTime, resolveDateTimeConfig } from '@/lib/datetime'

export function formatScheduleTime(
  date: string | null | undefined,
  settings: { timezone?: string | null; locale?: string | null; weekStartsOn?: string | null } | null,
): string | null {
  if (!date) return null
  return formatNotificationDateTime(new Date(date), resolveDateTimeConfig(settings))
}

// Deferred notification creation data
export interface DeferredNotification {
  docId: number | string
  title: string
  shortId: string
  statusLabel: string
  isUpdate: boolean
  updateIndex: number
  startTimeStr: string | null
  endTimeStr: string | null
  duration: string | undefined
  message?: string
  /** Eigener SMS- und ntfy-Text der Aktualisierung (aus einer Vorlage), ersetzt den allgemeinen SMS-Text */
  smsBody?: string
  ntfyBody?: string
}

// Helper to interpolate template placeholders
function interpolateTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '')
}

/** Legt den Benachrichtigungsentwurf zu einer Wartung an (Anlegen oder Aktualisierung) und gibt ihn zurück. */
export async function createMaintenanceNotification(payload: Payload, data: DeferredNotification) {
  // Fetch settings
  const settings = await payload.findGlobal({ slug: 'settings' })
  const smsSettings = await payload.findGlobal({ slug: 'sms-settings' })
  const { t } = translatorsFor()
  const siteName = settings.siteName || 'Status'
  const siteUrl = getServerUrl()

  // Get max lengths from SMS settings
  const titleMaxLength = smsSettings.templateTitleMaxLength || 50
  const messageMaxLength = smsSettings.templateMessageMaxLength || 100

  // Build schedule string for SMS (no newlines)
  let scheduleStr = ''
  if (data.startTimeStr && data.endTimeStr) {
    scheduleStr = `📅 ${data.startTimeStr} - ${data.endTimeStr}`
  } else if (data.startTimeStr) {
    scheduleStr = `📅 ${data.startTimeStr}`
    if (data.duration) {
      scheduleStr += ` (${data.duration})`
    }
  }

  // Truncate title and message for SMS
  const truncatedTitle = data.title.length > titleMaxLength
    ? data.title.substring(0, titleMaxLength - 3) + '...'
    : data.title

  const truncatedMessage = data.message
    ? (data.message.length > messageMaxLength ? data.message.substring(0, messageMaxLength - 3) + '...' : data.message)
    : ''

  const url = `${siteUrl}/m/${data.shortId}`

  const templateVars = {
    siteName,
    title: truncatedTitle,
    status: data.statusLabel,
    schedule: scheduleStr,
    message: truncatedMessage,
    url,
  }

  let smsBody: string
  if (data.isUpdate) {
    const template = smsSettings.templateMaintenanceUpdate || t('notif.smsMaintUpdate')
    smsBody = interpolateTemplate(template, templateVars)
  } else {
    const template = smsSettings.templateMaintenanceNew || t('notif.smsMaintNew')
    smsBody = interpolateTemplate(template, templateVars)
  }

  const emailBody = data.isUpdate
    ? `${t('notif.maintStatus')}: ${data.statusLabel}\n\n${data.message || ''}\n\n${t('notif.viewDetails')}: ${url}`
    : `${t('notif.maintScheduled')}\n\n${t('notif.maintStart')}: ${data.startTimeStr || t('notif.maintTbd')}\n${data.endTimeStr ? `${t('notif.maintEnd')}: ${data.endTimeStr}\n` : ''}${data.duration ? `${t('notif.maintDuration')}: ${data.duration}\n` : ''}\n${t('notif.maintNotify')}\n\n${t('notif.viewDetails')}: ${url}`

  const notification = await payload.create({
    collection: 'notifications',
    data: {
      title: data.isUpdate ? `[${t('notif.maintTag')} ${data.statusLabel}] ${data.title}` : `[${t('notif.maintScheduledTag')}] ${data.title}`,
      relatedMaintenance: typeof data.docId === 'string' ? parseInt(data.docId, 10) : data.docId,
      updateIndex: data.updateIndex,
      channel: 'both',
      status: 'draft',
      subject: data.isUpdate ? `[${t('notif.maintTag')} ${data.statusLabel}] ${data.title}` : `[${t('notif.maintScheduledTag')}] ${data.title}`,
      emailBody,
      smsBody: data.smsBody?.trim() || smsBody,
      ...(data.ntfyBody?.trim() ? { ntfyBody: data.ntfyBody.trim() } : {}),
    },
  })
  return notification
}

