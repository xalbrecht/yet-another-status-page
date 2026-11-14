import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initI18n } from '../../src/lib/i18n/init'
import type { LocaleFile } from '../../src/lib/i18n/locales'

const accepted = ['de', 'en', 'fr']
const file = (site: Record<string, string>, admin: Record<string, string> = {}): LocaleFile => ({ meta: { name: 'T' }, site, admin })
const builtin = {
  de: file({ 'a.key': 'Deutsch A', 'b.key': 'Deutsch B' }, { 'Admin': 'Administration' }),
  en: file({ 'a.key': 'English A', 'b.key': 'English B' }),
}

function withDir(files: Record<string, string>, run: (dir: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'locales-'))
  try {
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
    run(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('ohne Verzeichnis und ohne Variable: eingebautes Deutsch, Verzeichnis wird gemeldet', () => {
  const state = initI18n({ LOCALES_DIR: join(tmpdir(), 'gibt-es-nicht-locales') }, builtin, accepted)
  assert.equal(state.language, 'de')
  assert.equal(state.site['a.key'], 'Deutsch A')
  assert.equal(state.admin['Admin'], 'Administration')
  assert.deepEqual(state.available, ['de', 'en'])
  assert.equal(state.problems.length, 1)
})

test('DEFAULT_LANGUAGE=en ohne Verzeichnis: eingebautes Englisch', () => {
  const state = initI18n({ LOCALES_DIR: join(tmpdir(), 'gibt-es-nicht-locales'), DEFAULT_LANGUAGE: 'en' }, builtin, accepted)
  assert.equal(state.language, 'en')
  assert.equal(state.site['a.key'], 'English A')
  assert.deepEqual(state.admin, {})
})

test('zweite Sprache aus dem Verzeichnis: übersetzt französisch, Rest englisch', () => {
  const fr = JSON.stringify({ meta: { name: 'Français' }, site: { 'a.key': 'Français A' }, admin: { 'Media': 'Médias' } })
  withDir({ 'fr.json': fr }, (dir) => {
    const state = initI18n({ LOCALES_DIR: dir, DEFAULT_LANGUAGE: 'fr' }, builtin, accepted)
    assert.equal(state.language, 'fr')
    assert.equal(state.site['a.key'], 'Français A')
    assert.equal(state.site['b.key'], 'English B')
    assert.deepEqual(state.admin, { Media: 'Médias' })
    assert.deepEqual(state.available, ['de', 'en', 'fr'])
    assert.deepEqual(state.problems, [])
  })
})

test('DEFAULT_LANGUAGE nicht geladen: Deutsch und Problem', () => {
  withDir({}, (dir) => {
    const state = initI18n({ LOCALES_DIR: dir, DEFAULT_LANGUAGE: 'fr' }, builtin, accepted)
    assert.equal(state.language, 'de')
    assert.ok(state.problems.some((p) => p.includes('DEFAULT_LANGUAGE')))
  })
})

test('kaputte Datei und unbekannter Name: übrige Dateien werden geladen, Probleme genannt', () => {
  const fr = JSON.stringify({ meta: { name: 'Français' }, site: { 'a.key': 'Français A' }, admin: {} })
  withDir({ 'fr.json': fr, 'de.json': '{ kaputt', 'xx.json': fr }, (dir) => {
    const state = initI18n({ LOCALES_DIR: dir, DEFAULT_LANGUAGE: 'fr' }, builtin, accepted)
    assert.equal(state.language, 'fr')
    assert.equal(state.site['a.key'], 'Français A')
    assert.equal(state.problems.length, 2)
  })
})

test('Datei im Verzeichnis überschreibt die eingebaute Fassung je Schlüssel', () => {
  const de = JSON.stringify({ meta: { name: 'Deutsch' }, site: { 'a.key': 'Angepasst' }, admin: {} })
  withDir({ 'de.json': de }, (dir) => {
    const state = initI18n({ LOCALES_DIR: dir }, builtin, accepted)
    assert.equal(state.site['a.key'], 'Angepasst')
    assert.equal(state.site['b.key'], 'Deutsch B')
  })
})

test('alte Variable NEXT_PUBLIC_UI_LANG ohne DEFAULT_LANGUAGE: Warnung statt stillem Wechsel', () => {
  const state = initI18n(
    { LOCALES_DIR: join(tmpdir(), 'gibt-es-nicht-locales'), NEXT_PUBLIC_UI_LANG: 'en' },
    builtin,
    accepted,
  )
  assert.equal(state.language, 'de')
  assert.ok(state.problems.some((p) => p.includes('NEXT_PUBLIC_UI_LANG') && p.includes('DEFAULT_LANGUAGE')))
})

test('alte Variable bleibt ohne Wirkung, wenn DEFAULT_LANGUAGE gesetzt ist, und erzeugt keine Warnung', () => {
  const state = initI18n(
    { LOCALES_DIR: join(tmpdir(), 'gibt-es-nicht-locales'), NEXT_PUBLIC_UI_LANG: 'en', DEFAULT_LANGUAGE: 'de' },
    builtin,
    accepted,
  )
  assert.equal(state.language, 'de')
  assert.ok(!state.problems.some((p) => p.includes('NEXT_PUBLIC_UI_LANG')))
})
