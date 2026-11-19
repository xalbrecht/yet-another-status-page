/**
 * Wählt die E2E-Tests für einen Lauf (Issue #212). Regeln: `decideSelection` in `test-selection.ts`.
 *
 * Eingabe (Umgebung): E2E_EVENT (`push` oder `pull_request`, leer = pull_request),
 *   E2E_LABELS (JSON-Liste der PR-Labels), E2E_BASE_REF (Standard `origin/main`).
 * Ausgabe: `mode=all|some|none`, `lock=true|false`, `files` (eine Datei je Zeile) nach $GITHUB_OUTPUT,
 *   die Auswahl mit Grund nach $GITHUB_STEP_SUMMARY. Ohne diese Variablen geht beides nach stdout.
 *
 * Lokale Vorschau: `npm run select:e2e`.
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { listTests } from './e2e-list.mts'
import { decideSelection, type SelectionTable } from './test-selection'

const table = JSON.parse(readFileSync('tests/test-selection.json', 'utf8')) as SelectionTable
const event = process.env.E2E_EVENT || 'pull_request'
const labels = JSON.parse(process.env.E2E_LABELS || '[]') as string[]
const base = process.env.E2E_BASE_REF || 'origin/main'

const changed =
  event === 'push'
    ? []
    : execFileSync('git', ['diff', '--name-only', '--no-renames', `${base}...HEAD`], { encoding: 'utf8' })
        .split('\n')
        .filter(Boolean)

const sel = decideSelection({ event, labels, changed, tests: listTests(), table })
const files = sel.mode === 'some' ? sel.files : []
const lock = sel.mode === 'all' || (sel.mode === 'some' && sel.needsLockCheck)

const out = `mode=${sel.mode}\nlock=${lock}\nfiles<<EOF_FILES\n${files.join('\n')}\nEOF_FILES\n`
const summary = [
  '### Testauswahl',
  `- Modus: **${{ all: 'volle Suite', some: 'Auswahl', none: 'keine Tests' }[sel.mode]}**`,
  `- Grund: ${sel.reason}`,
  `- Geänderte Dateien: ${changed.length}`,
  ...(files.length ? ['- Testdateien:', ...files.map((f) => `  - \`${f}\``)] : []),
  '',
].join('\n')

if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, out)
else console.log(out)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)
else console.log(summary)
