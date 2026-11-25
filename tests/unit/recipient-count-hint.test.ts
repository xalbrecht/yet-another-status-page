import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import deJson from '../../locales/de.json' with { type: 'json' }

/**
 * Hinweis zur Empfängerzahl im Entwurf (#275): Die Zahl folgt dem gespeicherten Stand der Meldung,
 * der Hinweistext sagt das.
 */
const admin = deJson.admin as Record<string, string>

test('der Hinweis unter der Empfängerzahl nennt den gespeicherten Stand und das Speichern', () => {
  const source = readFileSync('src/components/admin/RecipientCountField.tsx', 'utf8')
  const key = [...source.matchAll(/ta\('(Active subscribers[^']*)'\)/g)][0]?.[1]
  assert.ok(key, 'Hinweis im Feld nicht gefunden')
  const text = admin[key]
  assert.ok(text, `Übersetzung fehlt: ${key}`)
  assert.match(text, /gespeicherten Stand/)
  assert.match(text, /zuerst speichern/)
})
