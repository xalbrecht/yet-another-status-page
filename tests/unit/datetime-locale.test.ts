import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveDateTimeConfig } from '../../src/lib/datetime'

test('die Datumssprache der gewählten Sprache geht vor dem gespeicherten Wert', () => {
  assert.equal(resolveDateTimeConfig({ dateLocale: 'de-DE', locale: 'en-US' }).locale, 'de-DE')
})

test('ohne Datumssprache gilt locale, ohne beides en-US', () => {
  assert.equal(resolveDateTimeConfig({ locale: 'fr-FR' }).locale, 'fr-FR')
  assert.equal(resolveDateTimeConfig({}).locale, 'en-US')
  assert.equal(resolveDateTimeConfig(null).locale, 'en-US')
})
