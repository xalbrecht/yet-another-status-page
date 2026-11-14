import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkLocales } from '../../scripts/check-locales'
import type { LocaleFile } from '../../src/lib/i18n/locales'

const file = (site: Record<string, string>, admin: Record<string, string> = {}): LocaleFile => ({ meta: { name: 'T' }, site, admin })
const reference = file({
  'a.key': 'Hello',
  'footer.timezone': 'Times in {timezone}',
  'tpl.key': 'Welcome to {{siteName}}',
})

test('vollständige und passende Datei: keine Meldung', () => {
  const fr = file({ 'a.key': 'Bonjour', 'footer.timezone': 'Heures en {timezone}', 'tpl.key': 'Bienvenue sur {{siteName}}' })
  assert.deepEqual(checkLocales({ fr }, reference), { errors: [], warnings: [] })
})

test('fehlender Schlüssel in site ist eine Warnung', () => {
  const fr = file({ 'a.key': 'Bonjour', 'tpl.key': 'Bienvenue sur {{siteName}}' })
  const result = checkLocales({ fr }, reference)
  assert.deepEqual(result.errors, [])
  assert.equal(result.warnings.length, 1)
  assert.ok(result.warnings[0].includes('fr') && result.warnings[0].includes('footer.timezone'))
})

test('überzähliger Schlüssel in site ist eine Warnung', () => {
  const fr = file({ 'a.key': 'A', 'footer.timezone': 'F {timezone}', 'tpl.key': 'T {{siteName}}', 'extra.key': 'X' })
  const result = checkLocales({ fr }, reference)
  assert.deepEqual(result.errors, [])
  assert.ok(result.warnings.some((w) => w.includes('extra.key')))
})

test('fehlender oder zusätzlicher Platzhalter in site ist ein Fehler', () => {
  const missing = file({ 'a.key': 'A', 'footer.timezone': 'Heures', 'tpl.key': 'T {{siteName}}' })
  assert.ok(checkLocales({ fr: missing }, reference).errors.some((e) => e.includes('footer.timezone')))
  const extra = file({ 'a.key': 'A {name}', 'footer.timezone': 'F {timezone}', 'tpl.key': 'T {{siteName}}' })
  assert.ok(checkLocales({ fr: extra }, reference).errors.some((e) => e.includes('a.key')))
})

test('{name} und {{name}} sind verschiedene Platzhalter', () => {
  const fr = file({ 'a.key': 'A', 'footer.timezone': 'F {timezone}', 'tpl.key': 'T {siteName}' })
  assert.ok(checkLocales({ fr }, reference).errors.some((e) => e.includes('tpl.key')))
})

test('admin: Platzhalter müssen zum englischen Schlüssel passen, ein Zusatz hinter | zählt nicht zum Text', () => {
  const ok = file({}, { 'Waiting for {{siteName}}': 'Attente de {{siteName}}', 'Admin|role': 'Administrateur' })
  assert.deepEqual(checkLocales({ fr: ok }, file({})).errors, [])
  const bad = file({}, { 'Waiting for {{siteName}}': 'Attente', 'Sent {count} mails': 'Envoyé {total} mails' })
  const errors = checkLocales({ fr: bad }, file({})).errors
  assert.equal(errors.length, 2)
})

test('mehrere Dateien werden einzeln gemeldet', () => {
  const fr = file({ 'a.key': 'A', 'footer.timezone': 'F', 'tpl.key': 'T {{siteName}}' })
  const es = file({ 'a.key': 'A', 'footer.timezone': 'F {timezone}', 'tpl.key': 'T' })
  const errors = checkLocales({ fr, es }, reference).errors
  assert.ok(errors.some((e) => e.startsWith('fr')) && errors.some((e) => e.startsWith('es')))
})
