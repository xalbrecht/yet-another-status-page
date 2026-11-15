import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateEmailHtml } from '@/lib/email'
import { translatorsFor } from '@/lib/i18n/translators'

const base = { siteName: 'Test', title: 'T', body: 'B', siteUrl: 'https://status.example', unsubscribeUrl: 'https://status.example/u' }

test('die feste Fußzeile der Mail folgt der übergebenen Sprache', () => {
  const de = generateEmailHtml({ ...base, language: 'de' })
  const en = generateEmailHtml({ ...base, language: 'en' })
  assert.ok(de.includes('<html lang="de">'))
  assert.ok(en.includes('<html lang="en">'))
  assert.ok(de.includes(translatorsFor('de').t('mail.unsubscribe')))
  assert.ok(en.includes(translatorsFor('en').t('mail.unsubscribe')))
  assert.notEqual(translatorsFor('de').t('mail.unsubscribe'), translatorsFor('en').t('mail.unsubscribe'))
})

test('eine unbekannte Sprache fällt auf die Prozesssprache zurück', () => {
  const html = generateEmailHtml({ ...base, language: 'zz' })
  assert.ok(html.includes(`<html lang="${translatorsFor('').lang}">`))
})
