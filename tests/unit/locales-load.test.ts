import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  parseLocaleFile,
  selectLanguage,
  buildSiteDictionary,
  buildAdminDictionary,
  lookup,
  type LocaleFile,
} from '../../src/lib/i18n/locales'
import { readLocaleDir } from '../../src/lib/i18n/read-locale-dir'

const accepted = ['de', 'en', 'fr']
const file = (site: Record<string, string>, admin: Record<string, string> = {}): LocaleFile => ({
  meta: { name: 'Test' },
  site,
  admin,
})
const builtin = {
  de: file({ 'a.key': 'Deutsch A', 'b.key': 'Deutsch B' }, { 'Admin': 'Administration' }),
  en: file({ 'a.key': 'English A', 'b.key': 'English B' }),
}

test('parseLocaleFile: gültige Datei', () => {
  const raw = { meta: { name: 'Français', dateLocale: 'fr-FR' }, site: { 'a.key': 'A' }, admin: { 'Admin': 'Admin' } }
  assert.deepEqual(parseLocaleFile('fr', raw, accepted), { file: raw })
})

test('parseLocaleFile: Dateiname ohne Payload-Sprachcode', () => {
  const result = parseLocaleFile('xx', file({}), accepted)
  assert.ok('problem' in result)
})

test('parseLocaleFile: falsche Form liefert ein Problem', () => {
  const cases: unknown[] = [
    null,
    { meta: { name: 'X' }, site: [], admin: {} },
    { meta: { name: 'X' }, site: { a: 1 }, admin: {} },
    { meta: { name: '' }, site: {}, admin: {} },
    { site: {}, admin: {} },
    { meta: { name: 'X' }, site: {}, admin: 'text' },
  ]
  for (const raw of cases) assert.ok('problem' in parseLocaleFile('fr', raw, accepted), JSON.stringify(raw))
})

test('parseLocaleFile: fehlender Block site oder admin gilt als leer', () => {
  const noAdmin = parseLocaleFile('fr', { meta: { name: 'X' }, site: { a: 'A' } }, accepted)
  assert.ok('file' in noAdmin)
  if ('file' in noAdmin) assert.deepEqual(noAdmin.file.admin, {})
  const noSite = parseLocaleFile('fr', { meta: { name: 'X' }, admin: { a: 'A' } }, accepted)
  assert.ok('file' in noSite)
  if ('file' in noSite) assert.deepEqual(noSite.file.site, {})
})

test('parseLocaleFile: die Meldung nennt den fehlerhaften Block und Schlüssel', () => {
  const wrongType = parseLocaleFile('fr', { meta: { name: 'X' }, site: [], admin: {} }, accepted)
  assert.ok('problem' in wrongType && wrongType.problem.includes('site ist kein Objekt'))
  const wrongValue = parseLocaleFile('fr', { meta: { name: 'X' }, site: { 'a.key': 1 }, admin: {} }, accepted)
  assert.ok('problem' in wrongValue && wrongValue.problem.includes('"a.key"'))
})

test('selectLanguage: ohne Angabe Deutsch', () => {
  assert.deepEqual(selectLanguage(undefined, ['de']), { language: 'de' })
})

test('selectLanguage: nicht verfügbare Sprache fällt auf Deutsch zurück und meldet es', () => {
  const result = selectLanguage('fr', ['de', 'en'])
  assert.equal(result.language, 'de')
  assert.ok(result.problem)
})

test('selectLanguage: verfügbare Sprache wird gewählt', () => {
  assert.deepEqual(selectLanguage('fr', ['de', 'en', 'fr']), { language: 'fr' })
})

test('buildSiteDictionary: Datei gewinnt je Schlüssel, Rest aus eingebauter Fassung', () => {
  const dict = buildSiteDictionary('de', { de: file({ 'a.key': 'Aus Datei' }) }, builtin)
  assert.equal(dict['a.key'], 'Aus Datei')
  assert.equal(dict['b.key'], 'Deutsch B')
})

test('buildSiteDictionary: ohne Datei die eingebaute Fassung der Sprache', () => {
  assert.equal(buildSiteDictionary('de', {}, builtin)['a.key'], 'Deutsch A')
  assert.equal(buildSiteDictionary('en', {}, builtin)['a.key'], 'English A')
})

test('buildSiteDictionary: fremde Sprache fällt je Schlüssel auf Englisch, nie auf Deutsch', () => {
  const dict = buildSiteDictionary('fr', { fr: file({ 'a.key': 'Français A' }) }, builtin)
  assert.equal(dict['a.key'], 'Français A')
  assert.equal(dict['b.key'], 'English B')
})

test('buildAdminDictionary: eingebautes Deutsch plus Datei, fremde Sprache nur Datei', () => {
  assert.equal(buildAdminDictionary('de', { de: file({}, { 'Media': 'Medien' }) }, builtin)['Admin'], 'Administration')
  assert.equal(buildAdminDictionary('de', { de: file({}, { 'Media': 'Medien' }) }, builtin)['Media'], 'Medien')
  assert.deepEqual(buildAdminDictionary('fr', { fr: file({}, { 'Media': 'Médias' }) }, builtin), { Media: 'Médias' })
})

test('lookup: nur eigene Eigenschaften mit Text', () => {
  const dict = { a: 'Text' }
  assert.equal(lookup(dict, 'a'), 'Text')
  assert.equal(lookup(dict, 'constructor'), undefined)
  assert.equal(lookup(dict, 'toString'), undefined)
  assert.equal(lookup(dict, '__proto__'), undefined)
})

test('readLocaleDir: gültige Datei geladen, kaputte und unbekannte übersprungen', () => {
  const dir = mkdtempSync(join(tmpdir(), 'locales-'))
  try {
    writeFileSync(join(dir, 'fr.json'), JSON.stringify({ meta: { name: 'Français' }, site: { 'a.key': 'A' }, admin: {} }))
    writeFileSync(join(dir, 'de.json'), '{ kaputt')
    writeFileSync(join(dir, 'xx.json'), JSON.stringify(file({})))
    writeFileSync(join(dir, 'notiz.txt'), 'kein JSON-Dateiname')
    const result = readLocaleDir(dir, accepted)
    assert.deepEqual(Object.keys(result.files), ['fr'])
    assert.equal(result.problems.length, 2)
    assert.ok(result.problems.some((p) => p.includes('de.json')))
    assert.ok(result.problems.some((p) => p.includes('xx.json')))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('readLocaleDir: fehlendes Verzeichnis und Datei statt Verzeichnis', () => {
  const missing = readLocaleDir(join(tmpdir(), 'gibt-es-nicht-locales'), accepted)
  assert.deepEqual(missing.files, {})
  assert.equal(missing.problems.length, 1)
  const dir = mkdtempSync(join(tmpdir(), 'locales-'))
  try {
    writeFileSync(join(dir, 'datei'), 'x')
    const notDir = readLocaleDir(join(dir, 'datei'), accepted)
    assert.deepEqual(notDir.files, {})
    assert.equal(notDir.problems.length, 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('readLocaleDir: UTF-8-Markierung am Dateianfang stört nicht', () => {
  const dir = mkdtempSync(join(tmpdir(), 'locales-'))
  try {
    writeFileSync(join(dir, 'fr.json'), '\uFEFF' + JSON.stringify({ meta: { name: 'Français' }, site: { 'a.key': 'A' }, admin: {} }))
    const result = readLocaleDir(dir, accepted)
    assert.deepEqual(result.problems, [])
    assert.deepEqual(Object.keys(result.files), ['fr'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('readLocaleDir: die Meldung nennt LOCALES_DIR, mit Bezeichnung den Standardordner', () => {
  const dir = join(tmpdir(), 'gibt-es-nicht-locales')
  assert.ok(readLocaleDir(dir, accepted).problems[0].startsWith('LOCALES_DIR "'))
  assert.ok(readLocaleDir(dir, accepted, 'Standardordner').problems[0].startsWith('Standardordner nicht lesbar'))
})
