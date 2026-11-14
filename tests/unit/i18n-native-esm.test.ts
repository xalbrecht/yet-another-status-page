import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Playwright lädt Module aus src/ als native ES-Module (package.json: "type": "module").
// Dort verlangt Node für JSON-Importe das Attribut `with { type: 'json' }`; tsx und der
// Bundler verlangen es nicht, deshalb fällt ein Fehlen erst beim Start der E2E-Tests auf.
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : []
  })
}

test('jeder JSON-Import in src/ trägt das Attribut with { type: \'json\' }', () => {
  const offenders: string[] = []
  for (const file of sourceFiles(join(process.cwd(), 'src'))) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (/^\s*import\b.*from\s+['"][^'"]+\.json['"]/.test(line) && !/with\s*\{\s*type:\s*['"]json['"]\s*\}/.test(line)) {
        offenders.push(`${file}: ${line.trim()}`)
      }
    }
  }
  assert.deepEqual(offenders, [])
})
