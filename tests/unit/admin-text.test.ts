import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveAdminText } from '../../src/lib/i18n/admin'

// Wörterbuch wie im Block admin von locales/de.json: Schlüssel = englischer Text,
// Schlüssel mit Zusatz = "Text|kontext".
const dict: Record<string, string> = {
  'Admin': 'Administration',
  'Admin|role': 'Administrator',
  'A | B': 'A oder B',
  'Waiting for {{siteName}}': 'Warte auf {{siteName}}',
  'Affected “Services”': 'Betroffene „Dienste“',
}

test('Deutsch: Eintrag ohne Zusatz', () => {
  assert.equal(resolveAdminText(dict, 'Admin'), 'Administration')
})

test('Deutsch: Eintrag mit Zusatz', () => {
  assert.equal(resolveAdminText(dict, 'Admin', 'role'), 'Administrator')
})

test('Deutsch: unbekannter Zusatz liefert die Fassung ohne Zusatz', () => {
  assert.equal(resolveAdminText(dict, 'Admin', 'gibtsnicht'), 'Administration')
})

test('Deutsch: Text mit senkrechtem Strich wird nicht zerlegt', () => {
  assert.equal(resolveAdminText(dict, 'A | B'), 'A oder B')
})

test('Deutsch: fehlender Eintrag liefert den englischen Text', () => {
  assert.equal(resolveAdminText(dict, 'Not translated'), 'Not translated')
  assert.equal(resolveAdminText(dict, 'Not translated', 'ctx'), 'Not translated')
})

test('Platzhalter und typografische Anführungszeichen bleiben erhalten', () => {
  assert.equal(resolveAdminText(dict, 'Waiting for {{siteName}}'), 'Warte auf {{siteName}}')
  assert.equal(resolveAdminText(dict, 'Affected “Services”'), 'Betroffene „Dienste“')
})

test('Leeres Wörterbuch (Englisch): der englische Text, auch mit Zusatz', () => {
  assert.equal(resolveAdminText({}, 'Admin'), 'Admin')
  assert.equal(resolveAdminText({}, 'Admin', 'role'), 'Admin')
})

test('Eigenschaften der Prototypkette sind keine Übersetzung', () => {
  assert.equal(resolveAdminText(dict, 'constructor'), 'constructor')
  assert.equal(resolveAdminText(dict, 'toString', 'x'), 'toString')
})
