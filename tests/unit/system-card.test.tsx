import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { ReactElement } from 'react'
import { renderToStaticMarkup as renderPlain } from 'react-dom/server'
import { withAdminText } from './i18n-helpers'
import { SystemCardView, type SystemInfoResponse } from '@/components/admin/SystemInfoView'

const render = (node: ReactElement) => renderPlain(withAdminText(node))

const base: SystemInfoResponse = {
  image: { tag: 'status-page:2026-11-16', date: '2026-11-16T09:15:35.000Z', commit: '0738982abcdef' },
  version: '0.6.0',
  node: 'v24.1.0',
  startedAt: '2026-11-16T11:00:00.000Z',
  container: true,
  lastMigration: '20261116_500100_seed_classification_rules',
  dateTime: { timezone: 'Europe/Berlin', locale: 'en-US', weekStartsOn: 'monday' },
}

const cell = (markup: string, key: string) => markup.match(new RegExp(`data-testid="system-${key}"[^>]*><dt>[^<]*</dt><dd>([^<]*)</dd>`))?.[1]

test('mit Image zeigt die Karte Tag, Datum in der Zeitzone der Einstellungen und den kurzen Commit', () => {
  const markup = render(<SystemCardView info={base} />)
  assert.equal(cell(markup, 'tag'), 'status-page:2026-11-16')
  assert.match(cell(markup, 'date') ?? '', /Nov 16, 2026.*10:15 AM.*(GMT\+1|CET)/)
  assert.equal(cell(markup, 'commit'), '0738982')
  assert.equal(cell(markup, 'version'), 'v0.6.0')
  assert.equal(cell(markup, 'node'), 'v24.1.0')
  assert.match(cell(markup, 'container') ?? '', /^(ja|yes)$/)
  assert.equal(cell(markup, 'migration'), '20261116_500100_seed_classification_rules')
  assert.doesNotMatch(markup, /system-card-no-image/)
})

test('ohne Image fehlen die Zeilen zu Tag, Datum und Commit und der Vermerk steht da', () => {
  const markup = render(<SystemCardView info={{ ...base, image: null }} />)
  assert.match(markup, /data-testid="system-card-no-image"/)
  assert.equal(cell(markup, 'tag'), undefined)
  assert.equal(cell(markup, 'date'), undefined)
  assert.equal(cell(markup, 'commit'), undefined)
  assert.equal(cell(markup, 'version'), 'v0.6.0')
})

test('fehlende Werte stehen als „unbekannt“ (englisch „unknown“) da, die Karte bleibt heil', () => {
  const markup = render(
    <SystemCardView info={{ ...base, image: { tag: null, date: null, commit: null }, container: null, lastMigration: null }} />,
  )
  for (const key of ['tag', 'date', 'commit', 'container', 'migration']) assert.match(cell(markup, key) ?? '', /^(unbekannt|unknown)$/, key)
})

test('scheitert der Abruf, steht ein Hinweis statt der Zeilen da', () => {
  const markup = render(<SystemCardView info={null} failed />)
  assert.match(markup, /data-testid="system-card-failed"/)
  assert.doesNotMatch(markup, /system-card__list/)
})

test('Werte aus der Umgebung werden maskiert', () => {
  const markup = render(<SystemCardView info={{ ...base, image: { tag: '<script>alert(1)</script>', date: null, commit: null } }} />)
  assert.doesNotMatch(markup, /<script>alert/)
  assert.match(markup, /&lt;script&gt;/)
})
