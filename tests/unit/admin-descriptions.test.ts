import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Jede description in Collections und Globals läuft durch ta(). Ein nacktes Textliteral bleibt im Admin englisch (Issue #114).
const dirs = ['src/globals', 'src/collections']

test('description-Texte in Collections und Globals sind mit ta() umschlossen', () => {
  const nackt: string[] = []
  for (const dir of dirs) {
    for (const name of readdirSync(dir).filter((file) => file.endsWith('.ts'))) {
      const text = readFileSync(join(dir, name), 'utf8')
      for (const treffer of text.matchAll(/\bdescription:\s*(['"`])/g)) {
        const zeile = text.slice(0, treffer.index).split('\n').length
        nackt.push(`${dir}/${name}:${zeile}`)
      }
    }
  }
  assert.deepEqual(nackt, [])
})
