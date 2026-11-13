import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { headers } from 'next/headers'
import config from '@payload-config'
import { isTestMode } from '@/lib/access'
import { sendEmail } from '@/lib/email'
import { ta } from '@/lib/i18n/admin'
import { parseRecipients } from '@/lib/report/export/recipients'
import { ReportMailPlanChangedError, ReportMailResumeError, ReportMailTooLargeError, sendReportMail } from '@/lib/report/export/mail'
import { loadReportContext } from '@/lib/report/load'
import type { EmailSetting } from '@/payload-types'

/**
 * Versendet den Bericht per Mail (Issue #65). Nur POST, nur angemeldete Nutzer (im Testmodus offen wie die übrigen
 * Routen). Die Empfänger kommen ausschließlich aus den E-Mail-Einstellungen. Jede Fehlerantwort trägt einen `code`,
 * nach dem die Berichtsseite ihre Erklärung wählt. Mit `resume=<k>&plan=<Kennung>` setzt der Versand ab Mail k fort.
 */
export const runtime = 'nodejs'

/** Höchstens ein Versand gleichzeitig im Prozess: Rendern und Anhänge brauchen Speicher (Test hat 768 MiB). */
let running = false

type Code = 'unauthorized' | 'bad-request' | 'invalid-period' | 'no-recipients' | 'no-smtp' | 'running' | 'too-large' | 'plan-changed' | 'send-failed' | 'unknown'
const fail = (code: Code, error: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ error, code, ...extra }, { status })

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await headers() })
    if (!user && !isTestMode()) return fail('unauthorized', ta('Authentication required'), 401)

    const search: Record<string, string | string[] | undefined> = {}
    for (const key of new Set(request.nextUrl.searchParams.keys())) {
      const values = request.nextUrl.searchParams.getAll(key)
      search[key] = values.length > 1 ? values : values[0]
    }

    if (Array.isArray(search.resume) || Array.isArray(search.plan)) {
      return fail('bad-request', ta('resume and plan may be given only once.', 'resume und plan dürfen nur einmal angegeben werden.'), 400)
    }
    const resumeText = typeof search.resume === 'string' ? search.resume : undefined
    const planId = typeof search.plan === 'string' && search.plan ? search.plan : undefined
    let resume: { from: number; planId: string } | undefined
    if (resumeText !== undefined || planId !== undefined) {
      const from = Number(resumeText)
      if (resumeText === undefined || planId === undefined || !Number.isInteger(from) || from < 1) {
        return fail('bad-request', ta('resume and plan must be given together, resume is a number from 1.', 'resume und plan gehören zusammen, resume ist eine Zahl ab 1.'), 400)
      }
      resume = { from, planId }
    }

    const loaded = await loadReportContext(payload, search)
    if (!loaded.ok) return fail('invalid-period', loaded.error, 400)

    const settings = (await payload.findGlobal({ slug: 'email-settings' })) as EmailSetting
    const recipients = parseRecipients(settings.reportRecipients)
    if (recipients.length === 0) {
      return fail('no-recipients', ta('Enter recipients in the email settings.', 'Empfänger in den E-Mail-Einstellungen eintragen.'), 400)
    }
    if (!settings.smtpHost || !settings.smtpFromAddress) {
      return fail('no-smtp', ta('SMTP is not set up. Enter server and sender address in the email settings. Nothing was sent.', 'SMTP ist nicht eingerichtet. Bitte in den E-Mail-Einstellungen Server und Absenderadresse eintragen. Es wurde nichts gesendet.'), 400)
    }

    if (running) return fail('running', ta('A dispatch is already running.', 'Es läuft bereits ein Versand.'), 409)
    running = true
    try {
      const result = await sendReportMail({ context: loaded.context, recipients, send: (options) => sendEmail(settings, options), resume })
      if (result.failed > 0) {
        return fail('send-failed', result.errors[0] ?? ta('Unknown error', 'Unbekannter Fehler'), 502, {
          sent: result.sent,
          mails: result.mails,
          planId: result.planId,
          nextMail: (resume?.from ?? 1) + result.sent,
        })
      }
      return NextResponse.json({ mails: result.mails, sent: result.sent, planId: result.planId, recipients, rejected: result.rejected })
    } catch (error) {
      if (error instanceof ReportMailTooLargeError) return fail('too-large', error.message, 413)
      if (error instanceof ReportMailResumeError) return fail('bad-request', error.message, 400)
      if (error instanceof ReportMailPlanChangedError) return fail('plan-changed', error.message, 412)
      throw error
    } finally {
      running = false
    }
  } catch (error) {
    console.error('[availability-report-send] failed:', error)
    return fail('unknown', ta('Unknown error'), 500)
  }
}
