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

test('translatorsFor fällt bei unbekannter oder fehlender Sprache auf DEFAULT_LANGUAGE zurück', async () => {
  const { translatorsFor } = await import('../../src/lib/i18n/translators')
  const { i18nState } = await import('../../src/lib/i18n/state')
  assert.equal(translatorsFor('zz').lang, i18nState.language)
  assert.equal(translatorsFor().lang, i18nState.language)
  assert.equal(translatorsFor('en').t('status.operational'), translatorsFor('en').dictionary['status.operational'])
  assert.notEqual(translatorsFor('en').t('status.operational'), translatorsFor('de').t('status.operational'))
  assert.equal(translatorsFor('de').dateLocale, 'de-DE')
})
