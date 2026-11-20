// Probe für #212 (Testauswahl ohne passenden Test), nicht mergen
// Fasst die Laufzeit einer E2E-Suite aus dem JSON-Bericht von Playwright zusammen (Markdown auf stdout).
// Aufruf: node scripts/e2e-timing.mjs [test-results/results.json] [Anzahl der langsamsten Tests]
import { readFileSync } from 'node:fs'

const file = process.argv[2] || 'test-results/results.json'
const top = Number(process.argv[3] || 20)

let report
try {
  report = JSON.parse(readFileSync(file, 'utf8'))
} catch (error) {
  console.log(`Kein Bericht in ${file}: ${error.message}`)
  process.exit(0)
}

const tests = []
const walk = (suite, titles) => {
  const path = suite.title && suite.file !== suite.title ? [...titles, suite.title] : titles
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      const ms = (t.results ?? []).reduce((sum, r) => sum + (r.duration ?? 0), 0)
      tests.push({ file: spec.file, title: [...path, spec.title].join(' › '), ms, status: t.status })
    }
  }
  for (const child of suite.suites ?? []) walk(child, path)
}
for (const suite of report.suites ?? []) walk(suite, [])

const sec = (ms) => (ms / 1000).toFixed(1)
const total = tests.reduce((sum, t) => sum + t.ms, 0)
const byFile = new Map()
for (const t of tests) byFile.set(t.file, (byFile.get(t.file) ?? 0) + t.ms)

console.log('## E2E-Laufzeit\n')
console.log(`${tests.length} Tests, Summe der Testzeiten ${sec(total)} s, Wanduhr ${sec(report.stats?.duration ?? 0)} s.\n`)
console.log('### Dateien\n\n| Datei | Tests | Sekunden |\n|---|---:|---:|')
for (const [name, ms] of [...byFile].sort((a, b) => b[1] - a[1])) {
  console.log(`| ${name} | ${tests.filter((t) => t.file === name).length} | ${sec(ms)} |`)
}
console.log(`\n### Die ${top} langsamsten Tests\n\n| Sekunden | Datei | Test |\n|---:|---|---|`)
for (const t of [...tests].sort((a, b) => b.ms - a.ms).slice(0, top)) {
  console.log(`| ${sec(t.ms)} | ${t.file} | ${t.title.replaceAll('|', '\\|')} |`)
}
