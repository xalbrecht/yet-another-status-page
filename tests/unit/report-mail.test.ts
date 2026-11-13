import { test } from 'node:test'
import assert from 'node:assert/strict'
import { unzipSync } from 'fflate'
import type { EmailOptions, EmailResult } from '@/lib/email'
import type { ExportFile } from '@/lib/report/export/files'
import { planReportMails, reportPlanId, ReportMailPlanChangedError, ReportMailResumeError, ReportMailTooLargeError, sendReportMail } from '@/lib/report/export/mail'
import type { ReportContext } from '@/lib/report/load'
import { parseReportParams } from '@/lib/report/params'

const file = (path: string, size: number, fill = 1): ExportFile => ({ path: `verfuegbarkeitsbericht-2026-10/${path}`, data: new Uint8Array(size).fill(fill) })
const png = (index: number, size = 2000, fill = index) => file(`gesamt/${String(index).padStart(2, '0')}.png`, size, fill)
const names = (mail: { attachments: Array<{ filename: string }> }) => mail.attachments.map((attachment) => attachment.filename)
const filesIn = (mail: { attachments: Array<{ content: Uint8Array }> }) => Object.keys(unzipSync(mail.attachments[0].content))

test('planReportMails: PDF und Excel gehen in Mail 1, die Bilder in ZIP-Teile', () => {
  const plan = planReportMails([file('b.pdf', 1000), file('b.xlsx', 2000), png(1), png(2), png(3)], 10_000)
  assert.equal(plan.length, 2)
  assert.equal(names(plan[0]).length, 2)
  assert.ok(names(plan[0]).some((name) => name.endsWith('.pdf')) && names(plan[0]).some((name) => name.endsWith('.xlsx')))
  assert.deepEqual(names(plan[1]), ['bilder-teil-1-von-1.zip'])
})

test('planReportMails: zehn Bilder zu 2000 Byte bei Grenze 5000 ergeben fünf Teile mit je zwei Dateien', () => {
  const plan = planReportMails([file('b.pdf', 10), file('b.xlsx', 10), ...Array.from({ length: 10 }, (_, index) => png(index + 1))], 5000)
  const parts = plan.slice(1)
  assert.equal(parts.length, 5)
  assert.deepEqual(parts.map((part) => names(part)[0]), [1, 2, 3, 4, 5].map((index) => `bilder-teil-${index}-von-5.zip`))
  for (const part of parts) assert.equal(filesIn(part).length, 2)
})

test('planReportMails: ein einzelnes Bild über der Grenze steht allein in einem Teil', () => {
  const plan = planReportMails([file('b.pdf', 10), file('b.xlsx', 10), png(1, 500), png(2, 9000), png(3, 500)], 5000)
  const parts = plan.slice(1)
  assert.equal(parts.length, 3)
  assert.deepEqual(parts.map((part) => filesIn(part).length), [1, 1, 1])
})

test('planReportMails: sind PDF und Excel zusammen über der Grenze, wirft die Funktion mit der Größe', () => {
  assert.throws(() => planReportMails([file('b.pdf', 4000), file('b.xlsx', 4000)], 5000), (error: unknown) => error instanceof ReportMailTooLargeError && /MB/.test(error.message))
})

test('planReportMails: ohne Bilder gibt es genau eine Mail', () => {
  assert.equal(planReportMails([file('b.pdf', 10), file('b.xlsx', 10)], 5000).length, 1)
})

test('planReportMails: gleiche Dateien ergeben byteweise gleiche ZIP-Teile', () => {
  const input = () => [file('b.pdf', 10), file('b.xlsx', 10), png(1), png(2)]
  const a = planReportMails(input(), 10_000)[1].attachments[0].content
  const b = planReportMails(input(), 10_000)[1].attachments[0].content
  assert.deepEqual(Buffer.from(a), Buffer.from(b))
})

test('reportPlanId ignoriert PDF und Excel, ändert sich aber mit einem Bild oder Pfad', () => {
  const base = [png(1), png(2)]
  const id = reportPlanId([file('x.pdf', 10, 7), ...base, file('x.xlsx', 10, 8)])
  assert.equal(reportPlanId([file('x.pdf', 99, 1), ...base, file('x.xlsx', 5, 2)]), id)
  assert.notEqual(reportPlanId([png(1), png(2, 2000, 99)]), id)
  assert.notEqual(reportPlanId([png(1), file('gesamt/anders.png', 2000, 2)]), id)
})

const params = parseReportParams({})
const context = { period: { key: '2026-10', label: 'Oktober 2026', start: 0, end: 1, partial: false }, params, locale: 'de-DE', timeZone: 'Europe/Berlin', groups: [], build: () => { throw new Error('nicht benötigt') } } as unknown as ReportContext
const filesOf = (files: ExportFile[]) => async function* () { for (const entry of files) yield entry }
const fourMails = () => [file('b.pdf', 10), file('b.xlsx', 10), ...Array.from({ length: 6 }, (_, index) => png(index + 1, 3000))]

function recorder(failAt: number[] = []) {
  const calls: EmailOptions[] = []
  let running = 0
  let overlap = false
  const send = async (options: EmailOptions): Promise<EmailResult> => {
    running++
    if (running > 1) overlap = true
    await new Promise((resolve) => setTimeout(resolve, 5))
    calls.push(options)
    running--
    return failAt.includes(calls.length) ? { success: false, error: 'Server nicht erreichbar' } : { success: true }
  }
  return { calls, send, get overlap() { return overlap } }
}

test('sendReportMail sendet nacheinander an alle Empfänger, der Betreff nennt den Zeitraum und die Teile', async () => {
  const r = recorder()
  const result = await sendReportMail({ context, recipients: ['a@x.de', 'b@x.de'], send: r.send, filesOf: filesOf(fourMails()), limit: 6000 })
  assert.equal(result.mails, 4)
  assert.equal(result.sent, 4)
  assert.equal(result.failed, 0)
  assert.equal(r.overlap, false)
  assert.deepEqual(r.calls.map((call) => call.to), Array(4).fill(['a@x.de', 'b@x.de']))
  assert.match(r.calls[0].subject, /Oktober 2026 \(Teil 1 von 4\)/)
  assert.match(r.calls[3].subject, /\(Teil 4 von 4\)/)
  assert.match(String(r.calls[0].text), /weiteren Mails|further emails/)
})

test('sendReportMail: eine einzige Mail trägt keine Teilnummer', async () => {
  const r = recorder()
  await sendReportMail({ context, recipients: ['a@x.de'], send: r.send, filesOf: filesOf([file('b.pdf', 10), file('b.xlsx', 10)]) })
  assert.equal(r.calls.length, 1)
  assert.doesNotMatch(r.calls[0].subject, /Teil/)
})

test('sendReportMail: scheitert die zweite Mail, endet der Versand mit Zahlen und Kennung', async () => {
  const r = recorder([2])
  const result = await sendReportMail({ context, recipients: ['a@x.de'], send: r.send, filesOf: filesOf(fourMails()), limit: 6000 })
  assert.equal(result.sent, 1)
  assert.equal(result.failed, 1)
  assert.deepEqual(result.errors, ['Server nicht erreichbar'])
  assert.equal(result.mails, 4)
  assert.equal(typeof result.planId, 'string')
  assert.equal(r.calls.length, 2)
})

test('sendReportMail: Fortsetzen ab Mail 2 sendet die Mails 2 bis 4 und nicht noch einmal Mail 1', async () => {
  const first = recorder([2])
  const failed = await sendReportMail({ context, recipients: ['a@x.de'], send: first.send, filesOf: filesOf(fourMails()), limit: 6000 })
  const second = recorder()
  const result = await sendReportMail({ context, recipients: ['a@x.de'], send: second.send, filesOf: filesOf(fourMails()), limit: 6000, resume: { from: 2, planId: failed.planId } })
  assert.equal(result.sent, 3)
  assert.equal(result.failed, 0)
  assert.deepEqual(second.calls.map((call) => /Teil (\d) von 4/.exec(call.subject)?.[1]), ['2', '3', '4'])
})

test('sendReportMail: haben sich die Daten geändert, wird nichts gesendet', async () => {
  const first = recorder([2])
  const failed = await sendReportMail({ context, recipients: ['a@x.de'], send: first.send, filesOf: filesOf(fourMails()), limit: 6000 })
  const changed = fourMails()
  changed[3] = png(2, 3000, 99)
  const second = recorder()
  await assert.rejects(() => sendReportMail({ context, recipients: ['a@x.de'], send: second.send, filesOf: filesOf(changed), limit: 6000, resume: { from: 2, planId: failed.planId } }), ReportMailPlanChangedError)
  assert.equal(second.calls.length, 0)
})

test('sendReportMail: ungültige Startnummern werfen, from 1 sendet alles', async () => {
  const r = recorder()
  for (const from of [0, 5, 1.5]) {
    await assert.rejects(() => sendReportMail({ context, recipients: ['a@x.de'], send: r.send, filesOf: filesOf(fourMails()), limit: 6000, resume: { from, planId: 'x' } }), ReportMailResumeError, String(from))
  }
  assert.equal(r.calls.length, 0)
  const all = await sendReportMail({ context, recipients: ['a@x.de'], send: r.send, filesOf: filesOf(fourMails()), limit: 6000, resume: { from: 1, planId: 'egal' } })
  assert.equal(all.sent, 4)
})

test('sendReportMail: ohne Empfänger wird vor jedem Versand geworfen', async () => {
  const r = recorder()
  await assert.rejects(() => sendReportMail({ context, recipients: [], send: r.send, filesOf: filesOf(fourMails()) }), /Empfänger|recipients/i)
  assert.equal(r.calls.length, 0)
})
