import { test } from 'node:test'
import assert from 'node:assert/strict'
import nodemailer from 'nodemailer'
import { buildMailMessage } from '@/lib/email'
import type { EmailSetting } from '@/payload-types'

const settings = { smtpHost: 'smtp.example', smtpFromAddress: 'status@example.de', smtpFromName: 'YASP Status' } as EmailSetting
const base = { subject: 'Betreff', html: '<p>Text</p>' }

test('mehrere Empfänger werden zu einer Zeichenkette mit Komma', () => {
  assert.equal(buildMailMessage(settings, { ...base, to: ['a@x.de', 'b@x.de'] }).to, 'a@x.de, b@x.de')
  assert.equal(buildMailMessage(settings, { ...base, to: 'a@x.de' }).to, 'a@x.de')
})

test('Anhänge werden als Buffer übergeben, ohne Anhänge bleibt das Feld leer', () => {
  const withFile = buildMailMessage(settings, { ...base, to: 'a@x.de', attachments: [{ filename: 'a.pdf', content: new Uint8Array([1, 2, 3]), contentType: 'application/pdf' }] })
  const attachments = withFile.attachments as Array<{ filename: string; content: unknown; contentType?: string }>
  assert.equal(attachments[0].filename, 'a.pdf')
  assert.ok(Buffer.isBuffer(attachments[0].content))
  assert.equal(attachments[0].contentType, 'application/pdf')
  assert.equal(buildMailMessage(settings, { ...base, to: 'a@x.de' }).attachments, undefined)
})

test('Absender und Antwortadresse stammen aus den Einstellungen', () => {
  const message = buildMailMessage(settings, { ...base, to: 'a@x.de' })
  assert.equal(message.from, '"YASP Status" <status@example.de>')
  assert.equal(message.replyTo, 'status@example.de')
})

test('der Anhang steht mit seinem Dateinamen in der fertigen Nachricht', async () => {
  const transport = nodemailer.createTransport({ jsonTransport: true })
  const info = await transport.sendMail(buildMailMessage(settings, { ...base, to: 'a@x.de', attachments: [{ filename: 'bericht.xlsx', content: new Uint8Array([9, 9]) }] }))
  assert.equal(JSON.parse(info.message as string).attachments[0].filename, 'bericht.xlsx')
})

test('verifySmtp meldet Erfolg, wenn der Handshake gelingt', async () => {
  const { verifySmtp } = await import('@/lib/email')
  assert.deepEqual(await verifySmtp(settings, async () => ({ verify: async () => true })), { ok: true })
})

test('verifySmtp meldet den Fehler des Servers, statt zu werfen', async () => {
  const { verifySmtp } = await import('@/lib/email')
  const result = await verifySmtp(settings, async () => ({ verify: async () => { throw new Error('connect ECONNREFUSED') } }))
  assert.deepEqual(result, { ok: false, error: 'connect ECONNREFUSED' })
})

test('der Kopf List-Unsubscribe nennt die Adresse der Einmalabmeldung', () => {
  const message = buildMailMessage(settings, {
    ...base,
    to: 'a@x.de',
    oneClickUnsubscribeUrl: 'https://status.example/api/unsubscribe/tok',
  })
  const headers = message.headers as Record<string, string>
  assert.equal(headers['List-Unsubscribe'], '<https://status.example/api/unsubscribe/tok>')
  assert.equal(headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click')
})

test('ohne Adresse der Einmalabmeldung setzt die Nachricht keinen Kopf List-Unsubscribe', () => {
  const message = buildMailMessage(settings, { ...base, to: 'a@x.de' })
  assert.deepEqual(message.headers, {})
})
