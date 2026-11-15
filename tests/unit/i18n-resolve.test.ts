import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deriveDateLocale, resolveLanguage } from '../../src/lib/i18n/locales'

const available = ['de', 'en', 'fr']

test('eine geladene Sprache wird übernommen', () => {
  assert.equal(resolveLanguage('fr', available, 'de'), 'fr')
})

test('eine unbekannte oder leere Sprache ergibt den Rückfall', () => {
  assert.equal(resolveLanguage('xx', available, 'de'), 'de')
  assert.equal(resolveLanguage('', available, 'de'), 'de')
  assert.equal(resolveLanguage(null, available, 'de'), 'de')
  assert.equal(resolveLanguage(undefined, available, 'en'), 'en')
})

test('der Name einer Eigenschaft von Object ist keine Sprache', () => {
  assert.equal(resolveLanguage('constructor', available, 'de'), 'de')
})

test('die Datumssprache kommt aus der Datei, sonst aus dem Code', () => {
  assert.equal(deriveDateLocale('de'), 'de-DE')
  assert.equal(deriveDateLocale('en'), 'en-US')
  assert.equal(deriveDateLocale('fr', { dateLocale: 'fr-CH' }), 'fr-CH')
  assert.equal(deriveDateLocale('nl'), 'nl')
})

test('der Name "constructor" ergibt keine abgeleitete Datumssprache der Prototypkette', () => {
  assert.equal(deriveDateLocale('constructor'), 'constructor')
})
