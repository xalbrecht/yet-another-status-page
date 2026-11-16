import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/**
 * Dateien, die im Browser laufen, dürfen nicht (auch nicht über andere Dateien) die Collections, die Payload-Konfiguration oder
 * Node-Module laden: Der Browser-Bundle bricht sonst ab, und die Anmeldeseite des Admins antwortet mit HTTP 500. Die Unit-Tests
 * laufen in Node und merken das nicht.
 */
const ROOT = resolve(process.cwd())
const CLIENT_ENTRIES = [
  'src/components/admin/incident-wizard/IncidentWizard.tsx',
  'src/components/admin/incident-wizard/IncidentWizardParts.tsx',
  'src/components/admin/incident-wizard/NewWithTemplateButton.tsx',
  'src/lib/incident-draft.ts',
]
const FORBIDDEN = [/^@\/collections/, /^@\/globals/, /^payload($|\/)/, /^@payloadcms\/db-/, /^@payload-config$/, /^node:/, /^fs$/, /^path$/, /^crypto$/]

function resolveImport(from: string, specifier: string): string | null {
  const base = specifier.startsWith('@/') ? join(ROOT, 'src', specifier.slice(2)) : specifier.startsWith('.') ? join(dirname(from), specifier) : null
  if (!base) return null
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(candidate) && !candidate.endsWith('/')) {
      try {
        readFileSync(candidate)
        return candidate
      } catch {
        // Verzeichnis: nächster Kandidat
      }
    }
  }
  return null
}

function importsOf(file: string): string[] {
  const source = readFileSync(file, 'utf-8')
  const found: string[] = []
  for (const match of source.matchAll(/^\s*(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/gm)) found.push(match[1])
  for (const match of source.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) found.push(match[1])
  return found
}

/** Alle Wege von einer Datei zu einem verbotenen Import, jeweils als Kette von Dateien. */
function violations(entry: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const walk = (file: string, chain: string[]) => {
    if (seen.has(file)) return
    seen.add(file)
    for (const specifier of importsOf(file)) {
      if (specifier.endsWith('.scss') || specifier.startsWith('type ')) continue
      if (FORBIDDEN.some((pattern) => pattern.test(specifier))) {
        out.push(`${[...chain, file].map((f) => f.replace(`${ROOT}/`, '')).join(' → ')} importiert ${specifier}`)
        continue
      }
      const next = resolveImport(file, specifier)
      if (next) walk(next, [...chain, file])
    }
  }
  walk(join(ROOT, entry), [])
  return out
}

for (const entry of CLIENT_ENTRIES) {
  test(`${entry} erreicht keine Collection, keine Payload-Konfiguration und kein Node-Modul`, () => {
    assert.deepEqual(violations(entry), [])
  })
}

test('der Wächter findet einen verbotenen Import (Gegenprobe über eine Datei, die ihn tatsächlich hat)', () => {
  assert.ok(violations('src/lib/message-templates.ts').length > 0, 'message-templates.ts zieht die Collections nach und gehört nicht in den Browser')
})
