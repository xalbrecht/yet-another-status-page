import type { BasePayload } from 'payload'
import { translatorsFor } from '@/lib/i18n/server'
import { deliverableSubscribersWhere, groupsForDelivery } from '@/lib/subscriber-filter'
import { sendBulkEmails, generateEmailHtml } from '@/lib/email'
import { sendBulkSms, formatSmsMessage } from '@/lib/sms'
import { getServerUrl } from '@/lib/utils'
import type { Setting, EmailSetting, SmsSetting, Subscriber, Media } from '@/payload-types'

export interface SendNotificationFromCollectionInput {
  notificationId: string
  channel: 'email' | 'sms' | 'both'
  subject?: string
  emailBody?: string
  smsBody?: string
  itemTitle: string
  itemUrl: string
}

interface TaskHandlerArgs {
  input: SendNotificationFromCollectionInput
  req: {
    payload: BasePayload
  }
}

export async function sendNotificationFromCollectionHandler({ input, req }: TaskHandlerArgs) {
  const { payload } = req
  const {
    notificationId,
    channel,
    subject,
    emailBody,
    smsBody,
    itemTitle,
    itemUrl,
  } = input

  // Fetch settings
  const settings = await payload.findGlobal({
    slug: 'settings',
    depth: 1,
  }) as Setting
  
  const emailSettings = await payload.findGlobal({
    slug: 'email-settings',
  }) as EmailSetting
  
  const smsSettings = await payload.findGlobal({
    slug: 'sms-settings',
  }) as SmsSetting

  const { t, tf, lang } = translatorsFor()
  const siteUrl = getServerUrl()
  const siteName = settings.siteName || 'Status Page'
  
  // Get logo URL for emails (use light logo since email backgrounds are white)
  const logoLight = settings.logoLight as Media | number | null | undefined
  const logoUrl = logoLight && typeof logoLight === 'object' ? logoLight.url : undefined

  // Nur Abonnenten, deren Gruppenwahl zu den Dienstgruppen der Meldung passt (leer: alle)
  const notification = await payload.findByID({ collection: 'notifications', id: notificationId, depth: 0 })
  const groups = notification ? await groupsForDelivery(payload, notification) : []

  // Fetch all subscribers with pagination to handle large lists
  const emailSubscribers: Subscriber[] = []
  const smsSubscribers: Subscriber[] = []
  
  const fetchSubscribers = async (type: 'email' | 'sms'): Promise<Subscriber[]> => {
    const subscribers: Subscriber[] = []
    let page = 1
    let hasMore = true
    const pageSize = 500
    
    while (hasMore) {
      const result = await payload.find({
        collection: 'subscribers',
        where: deliverableSubscribersWhere(type, groups),
        limit: pageSize,
        page,
      })
      
      subscribers.push(...(result.docs as Subscriber[]))
      hasMore = result.hasNextPage
      page++
    }
    
    return subscribers
  }
  
  // Fetch subscribers based on channel
  if (channel === 'email' || channel === 'both') {
    const emails = await fetchSubscribers('email')
    emailSubscribers.push(...emails.filter(s => s.email))
  }
  
  if (channel === 'sms' || channel === 'both') {
    const phones = await fetchSubscribers('sms')
    smsSubscribers.push(...phones.filter(s => s.phone))
  }

  let emailsSent = 0
  let smsSent = 0
  const errors: string[] = []

  // Send emails
  if ((channel === 'email' || channel === 'both') && emailSubscribers.length > 0) {
    if (!emailSettings.smtpHost || !emailSettings.smtpFromAddress) {
      errors.push('SMTP not configured')
    } else {
      const emails = emailSubscribers.map((subscriber) => {
        const unsubscribeUrl = subscriber.unsubscribeToken
          ? `${siteUrl}/unsubscribe/${subscriber.unsubscribeToken}`
          : `${siteUrl}/unsubscribe`
        const preferencesUrl = subscriber.unsubscribeToken
          ? `${siteUrl}/subscription/${subscriber.unsubscribeToken}`
          : undefined
        const oneClickUnsubscribeUrl = subscriber.unsubscribeToken
          ? `${siteUrl}/api/unsubscribe/${subscriber.unsubscribeToken}`
          : undefined

        const html = generateEmailHtml({
          siteName,
          title: subject || itemTitle || t('mail.defaultTitle'),
          body: emailBody || '',
          ctaText: t('mail.cta'),
          ctaUrl: itemUrl,
          unsubscribeUrl,
          preferencesUrl,
          siteUrl,
          logoUrl: logoUrl || undefined,
          language: lang,
        })

        return {
          to: subscriber.email!,
          subject: subject || tf('mail.defaultSubject', { siteName }),
          html,
          oneClickUnsubscribeUrl,
          language: lang,
        }
      })

      const result = await sendBulkEmails(emailSettings, emails)
      emailsSent = result.sent
      if (result.failed > 0) {
        errors.push(`${result.failed} email(s) failed: ${result.errors.slice(0, 3).join(', ')}`)
      }
    }
  }

  // Send SMS
  if ((channel === 'sms' || channel === 'both') && smsSubscribers.length > 0) {
    if (!smsSettings.twilioAccountSid || !smsSettings.twilioAuthToken || (!smsSettings.twilioFromNumber && !smsSettings.twilioMessagingServiceSid)) {
      errors.push('Twilio not configured')
    } else {
      const messages = smsSubscribers.map((subscriber) => ({
        to: subscriber.phone!,
        body: formatSmsMessage(smsBody || ''),
      }))

      const result = await sendBulkSms(smsSettings, messages)
      smsSent = result.sent
      if (result.failed > 0) {
        errors.push(`${result.failed} SMS failed: ${result.errors.slice(0, 3).join(', ')}`)
      }
    }
  }

  // Update the notification status
  const hasErrors = errors.length > 0 && emailsSent === 0 && smsSent === 0
  
  type NotificationUpdate = {
    status: 'sent' | 'failed'
    sentAt?: string | null
    recipientCount: number
    errorMessage?: string | null
  }
  
  const updateData: NotificationUpdate = {
    status: hasErrors ? 'failed' : 'sent',
    recipientCount: emailsSent + smsSent,
  }
  
  if (!hasErrors) {
    updateData.sentAt = new Date().toISOString()
  }
  
  if (errors.length > 0) {
    updateData.errorMessage = errors.join('; ')
  }
  
  await payload.update({
    collection: 'notifications',
    id: notificationId,
    data: updateData,
  })

  return {
    output: {
      emailsSent,
      smsSent,
      errors,
    },
  }
}
