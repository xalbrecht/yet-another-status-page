import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { scanAdminClientKeys } from '../../scripts/admin-client-keys'
import { getAdminDictionary } from '../../src/lib/i18n/admin'
import { i18nState } from '../../src/lib/i18n/state'

test('admin-client-keys.json passt zum Quelltext (sonst: npm run generate:admin-client-keys)', () => {
  const stored = JSON.parse(readFileSync('src/lib/i18n/admin-client-keys.json', 'utf8')) as string[]
  assert.deepEqual(stored, scanAdminClientKeys())
})

test('der Browser bekommt nur die Texte der Client-Komponenten', () => {
  const dictionary = getAdminDictionary()
  const full = Object.keys(i18nState.admin).length
  assert.ok(Object.keys(dictionary).length > 0)
  assert.ok(Object.keys(dictionary).length < full / 2, `${Object.keys(dictionary).length} von ${full}`)
  for (const [key, value] of Object.entries(dictionary)) assert.equal(value, i18nState.admin[key])
})

test('Texte der Client-Komponenten sind im gelieferten Wörterbuch (de)', () => {
  const dictionary = getAdminDictionary()
  const keys = JSON.parse(readFileSync('src/lib/i18n/admin-client-keys.json', 'utf8')) as string[]
  const missing = keys.filter((key) => Object.hasOwn(i18nState.admin, key) && !Object.hasOwn(dictionary, key))
  assert.deepEqual(missing, [])
})
