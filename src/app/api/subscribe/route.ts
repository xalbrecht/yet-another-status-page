import { NextRequest, NextResponse } from 'next/server'
import { getTranslators } from '@/lib/i18n/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { EmailSetting, Media, Setting, SmsSetting } from '@/payload-types'
import { getServerUrl } from '@/lib/utils'
import { sendSubscriptionConfirmationEmail, sendSubscriptionRequestEmail } from '@/lib/email'
import { isSmsConfigured, isValidPhone, smsSubscriptionProblem } from '@/lib/sms-configured'
import { reactivateSubscriber } from '@/lib/resubscribe'

// Rate limit configuration: 5 subscription attempts per IP per hour
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_HOURS = 1

function isEmailConfigured(emailSettings: EmailSetting): boolean {
  return Boolean(
    emailSettings.smtpHost &&
    emailSettings.smtpFromAddress &&
    emailSettings.enabled
  )
}

/**
 * Get client IP address from request headers
 */
function getClientIp(request: NextRequest): string {
  // Check common headers for real IP behind proxies
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Fallback - in production behind a proxy this shouldn't happen
  return 'unknown'
}

/**
 * Check rate limit using database
 * Returns the count of subscriptions from this IP in the time window
 */
async function checkDatabaseRateLimit(
  payload: Awaited<ReturnType<typeof getPayload>>,
  ipAddress: string
): Promise<{ allowed: boolean; count: number; resetTime: Date }> {
  const windowStart = new Date()
  windowStart.setHours(windowStart.getHours() - RATE_LIMIT_WINDOW_HOURS)

  // Count subscriptions from this IP in the rate limit window. Eine erneute Anmeldung (Reaktivierung) legt keinen
  // Datensatz an: Sie zählt als Eintrag dieser IP, der im Zeitfenster geändert wurde und danach aktiv, unbestätigt und
  // nicht freigegeben ist. Abmeldung, Bestätigung und Freigabe lassen einen Eintrag aus dieser Zählung fallen.
  const since = windowStart.toISOString()
  const result = await payload.count({
    collection: 'subscribers',
    where: {
      ipAddress: {
        equals: ipAddress,
      },
      or: [
        { createdAt: { greater_than: since } },
        {
          and: [
            { updatedAt: { greater_than: since } },
            { active: { equals: true } },
            { verified: { equals: false } },
            { addressConfirmed: { equals: false } },
          ],
        },
      ],
    },
  })

  const resetTime = new Date()
  resetTime.setHours(resetTime.getHours() + RATE_LIMIT_WINDOW_HOURS)

  return {
    allowed: result.totalDocs < RATE_LIMIT_MAX,
    count: result.totalDocs,
    resetTime,
  }
}

export async function POST(request: NextRequest) {
  const { t, lang } = getTranslators()
  try {
    const payload = await getPayload({ config })
    const clientIp = getClientIp(request)

    // Database-based rate limiting
    const rateLimit = await checkDatabaseRateLimit(payload, clientIp)

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: t('api.tooMany') },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.resetTime.getTime() - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimit.resetTime.getTime()),
          },
        }
      )
    }

    const body = await request.json()
    const { type, email, phone } = body

    // Validate input
    if (!type || !['email', 'sms'].includes(type)) {
      return NextResponse.json(
        { error: t('api.invalidType') },
        { status: 400 }
      )
    }

    const emailSettings = await payload.findGlobal({
      slug: 'email-settings',
    }) as EmailSetting

    if (type === 'email') {
      // Check if SMTP is configured
      if (!isEmailConfigured(emailSettings)) {
        return NextResponse.json(
          { error: t('api.emailUnavailable') },
          { status: 503 }
        )
      }

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json(
          { error: t('api.invalidEmail') },
          { status: 400 }
        )
      }

      // Ein aktiver Eintrag mit dieser Adresse bleibt ein Fall für 409. Wer sich abgemeldet hat (Eintrag inaktiv),
      // meldet sich erneut an: Der Eintrag wird wieder aktiviert und braucht Bestätigung und Freigabe von vorn.
      const existing = await payload.find({
        collection: 'subscribers',
        where: {
          email: {
            equals: email,
          },
          type: {
            equals: 'email',
          },
        },
        limit: 1,
      })
      const found = existing.docs[0]

      if (found && found.active !== false) {
        return NextResponse.json(
          { error: t('api.emailExists') },
          { status: 409 }
        )
      }

      // Create subscriber with IP address (needs address confirmation and operator approval)
      const subscriber = found
        ? await reactivateSubscriber(payload, found.id, { type: 'email', ipAddress: clientIp })
        : await payload.create({
            collection: 'subscribers',
            data: {
              type: 'email',
              email,
              verified: false,
              addressConfirmed: false,
              active: true,
              ipAddress: clientIp,
            },
          })

      // A failed mail must not fail the subscription: log and continue
      try {
        const siteUrl = getServerUrl()
        const settings = await payload.findGlobal({ slug: 'settings', depth: 1 }) as Setting
        const siteName = settings.siteName || 'Status Page'
        const logoLight = settings.logoLight as Media | number | null | undefined
        const logoUrl = logoLight && typeof logoLight === 'object' ? logoLight.url ?? undefined : undefined

        if (subscriber.verificationToken) {
          const result = await sendSubscriptionConfirmationEmail(emailSettings, {
            to: email,
            token: subscriber.verificationToken,
            siteName,
            siteUrl,
            logoUrl,
            language: lang,
          })
          if (!result.success) console.error('Confirmation email failed:', result.error)
        }

        if (emailSettings.subscriberRequestTo) {
          const result = await sendSubscriptionRequestEmail(emailSettings, {
            to: emailSettings.subscriberRequestTo,
            subscriberEmail: email,
            subscriberId: subscriber.id,
            siteName,
            siteUrl,
            logoUrl,
            language: lang,
          })
          if (!result.success) console.error('Subscription request email failed:', result.error)
        }
      } catch (mailError) {
        console.error('Error sending subscription emails:', mailError)
      }
    } else {
      // SMS: only when SMS is set up. The number is not confirmed by the subscriber,
      // so nothing is sent before the operator approves the subscriber (`verified`).
      const smsSettings = await payload.findGlobal({
        slug: 'sms-settings',
      }) as SmsSetting

      const configured = isSmsConfigured(smsSettings)
      // Look for the number only when the request can still succeed
      const existing = configured && isValidPhone(phone)
        ? await payload.find({
            collection: 'subscribers',
            where: {
              phone: {
                equals: phone,
              },
              type: {
                equals: 'sms',
              },
            },
            limit: 1,
          })
        : null
      const found = existing?.docs[0]
      // Nur ein aktiver Eintrag blockiert die Anmeldung, ein abgemeldeter wird wieder aktiviert
      const problem = smsSubscriptionProblem({ configured, phone, exists: Boolean(found && found.active !== false) })
      if (problem) {
        return NextResponse.json(
          { error: t(problem.key) },
          { status: problem.status }
        )
      }

      const subscriber = found
        ? await reactivateSubscriber(payload, found.id, { type: 'sms', ipAddress: clientIp })
        : await payload.create({
            collection: 'subscribers',
            data: {
              type: 'sms',
              phone,
              verified: false,
              active: true,
              ipAddress: clientIp,
            },
          })

      // Tell the operator about the request. A failed mail must not fail the subscription
      if (emailSettings.subscriberRequestTo && isEmailConfigured(emailSettings)) {
        try {
          const siteUrl = getServerUrl()
          const settings = await payload.findGlobal({ slug: 'settings', depth: 1 }) as Setting
          const logoLight = settings.logoLight as Media | number | null | undefined
          const result = await sendSubscriptionRequestEmail(emailSettings, {
            to: emailSettings.subscriberRequestTo,
            subscriberEmail: phone,
            subscriberId: subscriber.id,
            siteName: settings.siteName || 'Status Page',
            siteUrl,
            logoUrl: logoLight && typeof logoLight === 'object' ? logoLight.url ?? undefined : undefined,
            language: lang,
          })
          if (!result.success) console.error('Subscription request email failed:', result.error)
        } catch (mailError) {
          console.error('Error sending subscription request email:', mailError)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: type === 'sms' ? 'Subscription request received, waiting for approval' : 'Successfully subscribed via email',
    })
  } catch (error) {
    console.error('Error creating subscription:', error)
    return NextResponse.json(
      { error: t('api.createFailed') },
      { status: 500 }
    )
  }
}

// GET endpoint to check subscription availability
export async function GET() {
  const { t } = getTranslators()
  try {
    const payload = await getPayload({ config })
    const emailSettings = await payload.findGlobal({
      slug: 'email-settings',
    }) as EmailSetting

    const smsSettings = await payload.findGlobal({
      slug: 'sms-settings',
    }) as SmsSetting

    return NextResponse.json({
      email: isEmailConfigured(emailSettings),
      sms: isSmsConfigured(smsSettings),
    })
  } catch (error) {
    console.error('Error checking subscription availability:', error)
    return NextResponse.json(
      { error: t('api.availabilityFailed') },
      { status: 500 }
    )
  }
}
