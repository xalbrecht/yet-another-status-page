import { NextRequest, NextResponse } from 'next/server'
import { t } from '@/lib/i18n'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { EmailSetting, Media, Setting } from '@/payload-types'
import { getServerUrl } from '@/lib/utils'
import { sendSubscriptionConfirmationEmail, sendSubscriptionRequestEmail } from '@/lib/email'

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

  // Count subscriptions from this IP in the rate limit window
  const result = await payload.count({
    collection: 'subscribers',
    where: {
      ipAddress: {
        equals: ipAddress,
      },
      createdAt: {
        greater_than: windowStart.toISOString(),
      },
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
    const { type, email } = body

    // Validate input
    if (!type || !['email', 'sms'].includes(type)) {
      return NextResponse.json(
        { error: t('api.invalidType') },
        { status: 400 }
      )
    }

    // SMS subscriptions are disabled: there is no way to confirm a phone number
    if (type === 'sms') {
      return NextResponse.json(
        { error: t('api.smsUnavailable') },
        { status: 503 }
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

      // Check if email already exists
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
      })

      if (existing.docs.length > 0) {
        return NextResponse.json(
          { error: t('api.emailExists') },
          { status: 409 }
        )
      }

      // Create subscriber with IP address (needs address confirmation and operator approval)
      const subscriber = await payload.create({
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
          })
          if (!result.success) console.error('Subscription request email failed:', result.error)
        }
      } catch (mailError) {
        console.error('Error sending subscription emails:', mailError)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully subscribed via email',
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
  try {
    const payload = await getPayload({ config })
    const emailSettings = await payload.findGlobal({
      slug: 'email-settings',
    }) as EmailSetting

    return NextResponse.json({
      email: isEmailConfigured(emailSettings),
      sms: false,
    })
  } catch (error) {
    console.error('Error checking subscription availability:', error)
    return NextResponse.json(
      { error: t('api.availabilityFailed') },
      { status: 500 }
    )
  }
}
