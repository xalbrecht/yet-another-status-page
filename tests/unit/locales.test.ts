import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Prüft die Sprachdateien im Verzeichnis locales/ (Format: Abschnitt 4.2 des Entwurfs).
const dir = join(process.cwd(), 'locales')
const read = (name: string) => JSON.parse(readFileSync(join(dir, name), 'utf8'))
const de = read('de.json')
const en = read('en.json')

const placeholders = (text: string) => (text.match(/\{\{?\w+\}?\}/g) ?? []).sort()

test('de.json und en.json haben dieselben Schlüssel im Block site', () => {
  assert.deepEqual(Object.keys(de.site).sort(), Object.keys(en.site).sort())
})

test('kein Text im Block site ist leer', () => {
  for (const file of [de, en]) {
    for (const [key, value] of Object.entries(file.site)) {
      assert.ok(typeof value === 'string' && value.trim() !== '', `leer: ${key}`)
    }
  }
})

test('Platzhalter stimmen in Deutsch und Englisch überein', () => {
  for (const key of Object.keys(en.site)) {
    assert.deepEqual(placeholders(de.site[key]), placeholders(en.site[key]), `Platzhalter: ${key}`)
  }
})

test('meta enthält Anzeigename und Datumsformat', () => {
  assert.deepEqual(de.meta, { name: 'Deutsch', dateLocale: 'de-DE' })
  assert.deepEqual(en.meta, { name: 'English', dateLocale: 'en-US' })
})
