import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Texte in Collections und Globals laufen durch ta(). Ein nacktes Textliteral bleibt im Admin englisch (Issue #114, #123).
const dirs = ['src/globals', 'src/collections']

function scan(pattern: RegExp): string[] {
  const treffer: string[] = []
  for (const dir of dirs) {
    for (const name of readdirSync(dir).filter((file) => file.endsWith('.ts'))) {
      const text = readFileSync(join(dir, name), 'utf8')
      for (const match of text.matchAll(pattern)) {
        treffer.push(`${dir}/${name}:${text.slice(0, match.index).split('\n').length}`)
      }
    }
  }
  return treffer
}

test('description-Texte in Collections und Globals sind mit ta() umschlossen', () => {
  assert.deepEqual(scan(/\bdescription:\s*(['"`])/g), [])
})

test('Beschriftungen (label, placeholder, singular, plural) in Collections und Globals sind mit ta() umschlossen', () => {
  assert.deepEqual(scan(/\b(?:label|placeholder|singular|plural):\s*(['"`])/g), [])
})

test('Fehlermeldungen von validate und Hooks in Collections und Globals sind mit ta() umschlossen', () => {
  const nackt = [
    ...scan(/\breturn\s+(['"`])[A-Z]/g),
    ...scan(/\bthrow new (?:Error|APIError)\(\s*(['"`])/g),
  ]
  assert.deepEqual(nackt, [])
})

test('der Test erkennt ein nacktes Textliteral (Gegenprobe)', () => {
  assert.ok(/\breturn\s+(['"`])[A-Z]/.test("return 'Email is required'"))
  assert.ok(!/\breturn\s+(['"`])[A-Z]/.test("return ta('Email is required')"))
})
