/**
 * Prüft die Einteilung der E2E-Tests (Issue #211):
 *  - jeder Test trägt genau eine Ebene (@admin, @public, @api) und mindestens einen Bereich,
 *  - jede Datei unter `geprueftePfade` hat einen Eintrag in `tests/test-selection.json`,
 *  - kein Eintrag ist veraltet oder nennt einen unbekannten Tag.
 *
 * Aufruf: `npm run check:test-selection`. Exit 1 bei Fehlern. Es wird nichts ausgeführt, nur aufgelistet.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { checkTable, checkTests, type ListedTest, type SelectionTable } from './test-selection'

const table = JSON.parse(readFileSync('tests/test-selection.json', 'utf8')) as SelectionTable
const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean)

const listing = JSON.parse(
  execFileSync('npx', ['playwright', 'test', '--list', '--project=chromium', '--reporter=json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001' },
    stdio: ['ignore', 'pipe', 'ignore'],
  }),
) as { suites: unknown[] }

const tests: ListedTest[] = []
type Suite = { specs?: { file: string; title: string; tags?: string[] }[]; suites?: Suite[] }
const walk = (s: Suite): void => {
  for (const sp of s.specs ?? []) tests.push({ file: sp.file, title: sp.title, tags: sp.tags ?? [] })
  for (const c of s.suites ?? []) walk(c)
}
for (const s of listing.suites as Suite[]) walk(s)

const errors = [...checkTests(tests, table), ...checkTable(files, table)]
if (errors.length) {
  console.error(`FEHLER: ${errors.length} Befund(e) bei der Testauswahl:`)
  for (const e of errors) console.error(`  ${e}`)
  process.exit(1)
}
console.log(`Testauswahl in Ordnung: ${tests.length} Tests, ${Object.keys(table.pfade).length} Einträge in der Tabelle.`)
