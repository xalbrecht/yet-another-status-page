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
import { listTests } from './e2e-list.mts'
import { checkTable, checkTests, type SelectionTable } from './test-selection'

const table = JSON.parse(readFileSync('tests/test-selection.json', 'utf8')) as SelectionTable
const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean)

const tests = listTests()

const errors = [...checkTests(tests, table), ...checkTable(files, table)]
if (errors.length) {
  console.error(`FEHLER: ${errors.length} Befund(e) bei der Testauswahl:`)
  for (const e of errors) console.error(`  ${e}`)
  process.exit(1)
}
console.log(`Testauswahl in Ordnung: ${tests.length} Tests, ${Object.keys(table.pfade).length} Einträge in der Tabelle.`)
