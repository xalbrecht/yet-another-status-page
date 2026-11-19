/**
 * Listet alle E2E-Tests mit Datei, Titel und Tags auf (`playwright test --list`). Es wird nichts ausgeführt.
 * Gemeinsam genutzt von `check-test-selection.mts` und `select-e2e.mts` (Issue #211, #212).
 */
import { execFileSync } from 'node:child_process'
import type { ListedTest } from './test-selection'

type Suite = { specs?: { file: string; title: string; tags?: string[] }[]; suites?: Suite[] }

export function listTests(): ListedTest[] {
  const listing = JSON.parse(
    execFileSync('npx', ['playwright', 'test', '--list', '--project=chromium', '--reporter=json'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001' },
      stdio: ['ignore', 'pipe', 'ignore'],
    }),
  ) as { suites: Suite[] }

  const tests: ListedTest[] = []
  const walk = (s: Suite): void => {
    for (const sp of s.specs ?? []) tests.push({ file: sp.file, title: sp.title, tags: sp.tags ?? [] })
    for (const c of s.suites ?? []) walk(c)
  }
  for (const s of listing.suites) walk(s)
  return tests
}
