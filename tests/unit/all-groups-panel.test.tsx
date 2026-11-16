import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { AllGroupsPanel } from '@/components/status/lagebild/AllGroupsPanel'
import type { LagebildData, LagebildGroup } from '@/lib/lagebild'
import { withI18n } from './i18n-helpers'

const group = (n: number, over: Partial<LagebildGroup> = {}): LagebildGroup => ({
  id: String(n),
  name: `Gruppe ${n}`,
  icon: 'server',
  status: 'operational',
  bars: [{ status: 'operational', slots: 144 }],
  availability: 100,
  availabilityLabel: '100,00 %',
  availabilitySince: '',
  services: [],
  ...over,
})

const data = (groups: LagebildGroup[]): LagebildData => ({
  groups,
  allBars: [{ status: 'operational', slots: 144 }],
  periods: [],
  periodDays: 14,
  days: [],
  barsFrom: '09:10',
  barsTo: '21:10',
  barHours: 12,
  bar: { startMs: 0, slotMinutes: 5, slots: 144, nowMs: 0, locale: 'de-DE', timeZone: 'UTC', yesterday: 'gestern' },
})

const render = (groups: LagebildGroup[]) =>
  renderToStaticMarkup(withI18n(<AllGroupsPanel data={data(groups)} onSelect={() => {}} onClose={() => {}} />))

test('Panel „Alle“ zeigt je Gruppe eine Zeile mit Name, Zustand und Verfügbarkeit der Gruppe', () => {
  const markup = render([
    group(1),
    group(2, { status: 'partial', availabilityLabel: '97,50 %' }),
    group(3, { availabilityLabel: '' }),
  ])
  assert.equal(markup.split('data-testid="all-groups-row"').length - 1, 3)
  assert.ok(markup.includes('Gruppe 2'))
  assert.ok(markup.includes('Teilausfall'))
  assert.ok(markup.includes('97,50 %'))
  assert.ok(markup.includes('–'), 'unbekannte Verfügbarkeit erscheint als Strich')
})

test('Panel „Alle“ ist eine Region mit Schaltfläche zum Schließen', () => {
  const markup = render([group(1)])
  assert.match(markup, /role="region"[^>]*data-testid="lagebild-panel-all"/)
  assert.match(markup, />Schließen<\/button>/)
})

test('Panel „Alle“ nennt unter der Verfügbarkeit den Zeitraum, bei kürzerem Protokoll „seit …“', () => {
  const markup = render([group(1), group(2, { availabilitySince: 'seit 12.11.2026, 10:00' })])
  const rows = markup.split('data-testid="all-groups-row"').slice(1)
  assert.ok(rows[0].includes('14 Tage') || rows[0].includes('14 days'), 'ohne Angabe steht der Zeitraum da')
  assert.ok(!rows[0].includes('seit 12.11.2026'))
  assert.ok(rows[1].includes('seit 12.11.2026, 10:00'))
  assert.ok(!rows[1].includes('14 Tage') && !rows[1].includes('14 days'), 'der Zeitraum entfällt, wenn „seit …“ gilt')
})
