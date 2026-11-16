import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectSystemInfo, shortCommit, summaryLine, type SystemInfoSources } from '@/lib/system-info'

const NOW = Date.UTC(2026, 10, 16, 12, 0, 0)

const sources = (overrides: Partial<SystemInfoSources> = {}): SystemInfoSources => ({
  env: {},
  version: '0.6.0',
  nodeVersion: 'v24.1.0',
  uptimeSeconds: 3600,
  now: NOW,
  fileExists: () => false,
  lastMigration: async () => '20261116_500100_seed_classification_rules',
  ...overrides,
})

test('mit Build-Angaben: Tag, Datum (UTC) und Commit stehen im Ergebnis', async () => {
  const info = await collectSystemInfo(
    sources({ env: { YASP_BUILD_TAG: 'status-page:2026-11-16', YASP_BUILD_DATE: '2026-11-16T09:15:35Z', YASP_BUILD_COMMIT: '0738982' } }),
  )
  assert.deepEqual(info.image, { tag: 'status-page:2026-11-16', date: '2026-11-16T09:15:35.000Z', commit: '0738982' })
})

test('ohne Build-Angaben gibt es kein Image, Version und Laufzeitangaben bleiben', async () => {
  const info = await collectSystemInfo(sources())
  assert.equal(info.image, null)
  assert.equal(info.version, '0.6.0')
  assert.equal(info.node, 'v24.1.0')
  assert.equal(info.startedAt, '2026-11-16T11:00:00.000Z')
})

test('leere und nur aus Leerzeichen bestehende Werte zählen als nicht gesetzt', async () => {
  const info = await collectSystemInfo(sources({ env: { YASP_BUILD_TAG: '  ', YASP_BUILD_DATE: '', YASP_BUILD_COMMIT: undefined } }))
  assert.equal(info.image, null)
})

test('fehlt nur ein Wert, bleibt das Image und der Wert ist leer', async () => {
  const info = await collectSystemInfo(sources({ env: { YASP_BUILD_TAG: 'status-page:2026-11-16' } }))
  assert.deepEqual(info.image, { tag: 'status-page:2026-11-16', date: null, commit: null })
})

test('ein ungültiges Datum wird zu leer statt die Seite zu stören', async () => {
  const info = await collectSystemInfo(sources({ env: { YASP_BUILD_TAG: 'x', YASP_BUILD_DATE: 'gestern' } }))
  assert.equal(info.image?.date, null)
})

test('sehr lange Werte werden gekürzt', async () => {
  const info = await collectSystemInfo(sources({ env: { YASP_BUILD_TAG: 'a'.repeat(500) } }))
  assert.equal(info.image?.tag?.length, 200)
})

test('Container wird über die Datei /.dockerenv erkannt', async () => {
  const paths: string[] = []
  const inside = await collectSystemInfo(sources({ fileExists: (path) => { paths.push(path); return true } }))
  assert.equal(inside.container, true)
  assert.deepEqual(paths, ['/.dockerenv'])
  assert.equal((await collectSystemInfo(sources({ fileExists: () => false }))).container, false)
})

test('scheitert die Prüfung des Containers, ist der Wert leer und die Seite bleibt heil', async () => {
  const info = await collectSystemInfo(sources({ fileExists: () => { throw new Error('EACCES') } }))
  assert.equal(info.container, null)
  assert.equal(info.version, '0.6.0')
})

test('scheitert die Abfrage der Migration, ist der Wert leer und die übrigen Angaben bleiben', async () => {
  const info = await collectSystemInfo(sources({ env: { YASP_BUILD_TAG: 'x' }, lastMigration: async () => { throw new Error('Datenbank nicht erreichbar') } }))
  assert.equal(info.lastMigration, null)
  assert.equal(info.image?.tag, 'x')
})

test('die zuletzt angewandte Migration steht im Ergebnis, eine leere Antwort wird zu leer', async () => {
  assert.equal((await collectSystemInfo(sources())).lastMigration, '20261116_500100_seed_classification_rules')
  assert.equal((await collectSystemInfo(sources({ lastMigration: async () => '' }))).lastMigration, null)
})

test('der Commit wird auf 7 Zeichen gekürzt', () => {
  assert.equal(shortCommit('0738982abcdef0123456789'), '0738982')
  assert.equal(shortCommit('0738982'), '0738982')
})

test('die Zeile der Seitenleiste nennt Tag und Datum, ohne Image Version und Vermerk', async () => {
  const english = (text: string) => text
  const format = (iso: string) => `[${iso.slice(0, 10)}]`
  const withImage = await collectSystemInfo(sources({ env: { YASP_BUILD_TAG: 'status-page:2026-11-16', YASP_BUILD_DATE: '2026-11-16T09:15:35Z' } }))
  assert.equal(summaryLine(withImage, format, english), 'status-page:2026-11-16 · [2026-11-16]')
  const without = await collectSystemInfo(sources())
  assert.equal(summaryLine(without, format, english), 'v0.6.0 · Development build, no YASP image')
  const partial = await collectSystemInfo(sources({ env: { YASP_BUILD_COMMIT: '0738982' } }))
  assert.equal(summaryLine(partial, format, english), 'unknown')
})
