import { createHash } from 'node:crypto'
import { zipSync } from 'fflate'
import { ta } from '@/lib/i18n/admin'
import type { EmailAttachment, EmailOptions, EmailResult } from '@/lib/email'
import type { ReportContext } from '@/lib/report/load'
import { exportFiles, type ExportFile } from './files'

/**
 * Mailversand des Berichts (Issue #65): Mail 1 trägt PDF und Excel, die Bilder folgen in ZIP-Teilen unter einer festen
 * Größengrenze, jeder Teil eine eigene Mail. Mails gehen nacheinander raus. Nach einem Fehler lässt sich ab der ersten
 * nicht gesendeten Mail fortsetzen, solange die Kennung des Plans (Inhalt der Bilder) gleich geblieben ist.
 */

/** Postfix nimmt standardmäßig 10 240 000 Byte je Mail an, Base64 macht aus 6 MB rund 8,2 MB. */
export const MAIL_PART_LIMIT_BYTES = 6_000_000

const FIXED_MTIME = new Date('2000-01-01T00:00:00Z')

export type MailPlan = Array<{ attachments: EmailAttachment[] }>

export class ReportMailTooLargeError extends Error {
  constructor(public readonly megabytes: number, public readonly limitMegabytes: number) {
    super(`${ta('PDF and Excel are', 'PDF und Excel sind zusammen')} ${megabytes.toFixed(1)} MB ${ta('together, the limit is', 'groß, erlaubt sind')} ${limitMegabytes.toFixed(1)} MB ${ta('per email. Nothing was sent.', 'je Mail. Es wurde nichts gesendet.')}`)
    this.name = 'ReportMailTooLargeError'
  }
}

export class ReportMailResumeError extends Error {
  constructor(from: number, mails: number) {
    super(`${ta('Invalid start mail', 'Ungültige Startmail')}: ${from} (1 ${ta('to', 'bis')} ${mails})`)
    this.name = 'ReportMailResumeError'
  }
}

export class ReportMailPlanChangedError extends Error {
  constructor() {
    super(ta('The data of the report changed since the first attempt.', 'Die Daten des Berichts haben sich seit dem ersten Versuch geändert.'))
    this.name = 'ReportMailPlanChangedError'
  }
}

/** Reihenfolge nach Codepunkten: unabhängig von der Locale des Prozesses, damit Kennung und ZIP-Teile stabil bleiben. */
const byPath = (a: ExportFile, b: ExportFile) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)

const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1)

/** Kennung der Bilder: SHA-256 über Pfad und Inhalt jeder PNG-Datei in Pfadreihenfolge. PDF und Excel enthalten Zeitstempel und zählen nicht. */
export function reportPlanId(files: ExportFile[]): string {
  const hash = createHash('sha256')
  for (const entry of files.filter((item) => item.path.endsWith('.png')).sort(byPath)) {
    hash.update(entry.path).update('\0').update(createHash('sha256').update(entry.data).digest()).update('\0')
  }
  return hash.digest('hex')
}

export function planReportMails(files: ExportFile[], limit: number = MAIL_PART_LIMIT_BYTES): MailPlan {
  const documents = files.filter((entry) => entry.path.endsWith('.pdf') || entry.path.endsWith('.xlsx'))
  const documentBytes = documents.reduce((sum, entry) => sum + entry.data.length, 0)
  if (documentBytes > limit) throw new ReportMailTooLargeError(documentBytes / 1_000_000, limit / 1_000_000)

  const plan: MailPlan = []
  if (documents.length > 0) {
    plan.push({
      attachments: documents.map((entry) => ({
        filename: baseName(entry.path),
        content: entry.data,
        contentType: entry.path.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })),
    })
  }

  const parts: ExportFile[][] = []
  let current: ExportFile[] = []
  let currentBytes = 0
  for (const entry of files.filter((item) => item.path.endsWith('.png')).sort(byPath)) {
    if (current.length > 0 && currentBytes + entry.data.length > limit) {
      parts.push(current)
      current = []
      currentBytes = 0
    }
    current.push(entry)
    currentBytes += entry.data.length
  }
  if (current.length > 0) parts.push(current)

  parts.forEach((part, index) => {
    const zipped = zipSync(Object.fromEntries(part.map((entry) => [entry.path, [entry.data, { level: 0, mtime: FIXED_MTIME }]])))
    plan.push({ attachments: [{ filename: `bilder-teil-${index + 1}-von-${parts.length}.zip`, content: zipped, contentType: 'application/zip' }] })
  })
  return plan
}

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function sendReportMail(input: {
  context: ReportContext
  recipients: string[]
  send: (options: EmailOptions) => Promise<EmailResult>
  resume?: { from: number; planId: string }
  /** Quelle der Dateien, im Test ersetzbar */
  filesOf?: (context: ReportContext) => AsyncIterable<ExportFile>
  limit?: number
}): Promise<{ mails: number; sent: number; failed: number; errors: string[]; planId: string; rejected: string[] }> {
  const { context, recipients, send, resume } = input
  if (recipients.length === 0) throw new Error(ta('No recipients entered', 'Keine Empfänger eingetragen'))

  const files: ExportFile[] = []
  for await (const entry of (input.filesOf ?? exportFiles)(context)) files.push(entry)
  const plan = planReportMails(files, input.limit)
  const planId = reportPlanId(files)
  const mails = plan.length

  let first = 1
  if (resume) {
    if (!Number.isInteger(resume.from) || resume.from < 1 || resume.from > mails) {
      throw new ReportMailResumeError(resume.from, mails)
    }
    if (resume.from > 1 && resume.planId !== planId) throw new ReportMailPlanChangedError()
    first = resume.from
  }

  let sent = 0
  const errors: string[] = []
  const rejected = new Set<string>()
  for (let number = first; number <= mails; number++) {
    const part = mails > 1 ? ` (${ta('Part', 'Teil')} ${number} ${ta('of', 'von')} ${mails})` : ''
    const lines = [
      `${ta('Availability report', 'Verfügbarkeitsbericht')} ${context.period.label}.`,
      number === 1 && mails > 1 ? ta(`This email holds the PDF and the Excel file. The images follow in ${mails - 1} further emails.`, `Diese Mail enthält das PDF und die Excel-Datei. Die Bilder folgen in ${mails - 1} weiteren Mails.`) : '',
      number > 1 ? ta('The images are in the attached ZIP file.', 'Die Bilder liegen in der angehängten ZIP-Datei.') : '',
      resume && number === first && first > 1 ? ta('This email continues an interrupted dispatch.', 'Diese Mail setzt einen unterbrochenen Versand fort.') : '',
    ].filter(Boolean)
    const result = await send({
      to: recipients,
      subject: `${ta('Availability report', 'Verfügbarkeitsbericht')} ${context.period.label}${part}`,
      html: lines.map((line) => `<p>${escapeHtml(line)}</p>`).join(''),
      text: lines.join('\n'),
      attachments: plan[number - 1].attachments,
    })
    if (!result.success) {
      errors.push(result.error ?? 'Unknown error')
      return { mails, sent, failed: 1, errors, planId, rejected: [...rejected] }
    }
    for (const address of result.rejected ?? []) rejected.add(address)
    sent++
  }
  return { mails, sent, failed: 0, errors, planId, rejected: [...rejected] }
}
