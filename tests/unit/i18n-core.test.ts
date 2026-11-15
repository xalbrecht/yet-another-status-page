import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeTranslators } from '../../src/lib/i18n/core'

const dict = {
  'a.key': 'Text A',
  'footer.timezone': 'Zeiten in {timezone}',
  'tpl.key': 'Hallo {{siteName}} und {name}',
}
const { t, tf } = makeTranslators(dict)

test('t liefert den Text', () => {
  assert.equal(t('a.key' as never), 'Text A')
})

test('t liefert bei fehlendem Schlüssel den Schlüssel selbst', () => {
  assert.equal(t('fehlt.key' as never), 'fehlt.key')
})

test('t liefert für Eigenschaften der Prototypkette nie eine Funktion', () => {
  assert.equal(t('constructor' as never), 'constructor')
  assert.equal(t('toString' as never), 'toString')
})

test('tf ersetzt {name}, lässt unbekannte Platzhalter und {{name}} unverändert', () => {
  assert.equal(tf('footer.timezone' as never, { timezone: 'UTC' }), 'Zeiten in UTC')
  assert.equal(tf('footer.timezone' as never, {}), 'Zeiten in {timezone}')
  assert.equal(tf('tpl.key' as never, { name: 'X' }), 'Hallo {{siteName}} und X')
})

test('tf lässt {{name}} auch unverändert, wenn die Variablen name enthalten', () => {
  assert.equal(tf('tpl.key' as never, { siteName: 'S', name: 'X' }), 'Hallo {{siteName}} und X')
})

test('tf setzt Zahlen ein', () => {
  const { tf: numbers } = makeTranslators({ 'n.key': '{count} Einträge' })
  assert.equal(numbers('n.key' as never, { count: 3 }), '3 Einträge')
})
