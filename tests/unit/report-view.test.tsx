import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReportView } from '@/components/admin/availability-report/ReportView'
import { ReportControlsForm, shouldSubmitOnChange } from '@/components/admin/availability-report/ReportControlsForm'
import type { ReportData, RankingRow } from '@/lib/report/aggregate'
import { parseReportParams } from '@/lib/report/params'

const MIN = 60_000
const months = Array.from({ length: 12 }, (_, index) => ({ key: `2026-${String(index + 1).padStart(2, '0')}`, label: `M${index + 1}` }))
const row = (name: string, availability: number | null, belowTarget: boolean): RankingRow => ({
  serviceId: name.length,
  name,
  groupName: 'Haushalt',
  availability,
  previousAvailability: 100,
  downMs: belowTarget ? 2793 * MIN : 0,
  outageCount: belowTarget ? 1 : 0,
  longestOutageMs: belowTarget ? 2793 * MIN : 0,
  maintenanceDownMs: 0,
  target: 99,
  belowTarget,
  history: Array.from({ length: 12 }, () => availability),
})
const data: ReportData = {
  scope: { groupId: null, groupName: null, serviceCount: 166 },
  kpis: {
    availability: 99.7123,
    previousAvailability: 99.5,
    downMs: 357 * 60 * MIN,
    previousDownMs: 80 * 60 * MIN,
    affectedServices: 20,
    serviceCount: 166,
    outageCount: 24,
    longestOutage: { ms: 2793 * MIN, serviceName: 'Infoma' },
    degradedMs: 180 * MIN,
    maintenanceMs: 600 * MIN,
    monthsMet: 1,
    monthsTotal: 1,
    target: 99,
  },
  weakest: [row('Infoma', 93.74, true)],
  trend: months.map((month, index) => ({ ...month, availability: 99.2 + index * 0.05 })),
  heat: {
    columns: months,
    rows: [
      { name: 'Gesamt', values: months.map(() => 99.7), total: true },
      { name: 'Haushalt und Finanzen', values: months.map((_, index) => (index === 11 ? 93.7 : 100)) },
    ],
  },
  ranking: [row('Infoma', 93.74, true), row('VPN', 99.9, false)],
  groupList: [],
  sheet: null,
  footnotes: { unsure: 78, withoutService: 19 },
}
const params = parseReportParams({ maintenance: 'B', calc: 'monthly', topN: '7' })
const period = { key: '2026-10', label: 'Oktober 2026', start: 0, end: 1, partial: false }
const render = (override: Partial<Parameters<typeof ReportView>[0]> = {}) =>
  renderToStaticMarkup(<ReportView data={data} params={params} period={period} locale="de-DE" controls={<div data-testid="controls" />} {...override} />)

test('zeigt Überschrift mit Zeitraum, Verfügbarkeit mit Komma und Zielstatus', () => {
  const markup = render()
  assert.match(markup, /Oktober 2026/)
  assert.match(markup, /99,71 %/)
  assert.match(markup, /data-testid="controls"/)
})

test('der Vermerk „unter Ziel“ steht nur bei dem Dienst unter dem Zielwert', () => {
  const markup = render()
  assert.equal((markup.match(/unter Ziel|below target/g) ?? []).length >= 1, true)
  const ranking = markup.slice(markup.indexOf('data-testid="report-ranking"'))
  assert.equal((ranking.match(/report-below-target/g) ?? []).length, 1)
})

test('Fußnoten nennen die Zahlen', () => {
  const markup = render()
  assert.match(markup, /78/)
  assert.match(markup, /19/)
})

test('Wartungszeile nur bei eingeschalteter Anzeige', () => {
  assert.match(render(), /data-testid="report-maintenance"/)
  const hidden = render({ params: parseReportParams({ showMaintenance: 'false' }) })
  assert.doesNotMatch(hidden, /data-testid="report-maintenance"/)
})

test('Wärmekarte mit Gesamtzeile und ohne Rot-Grün-Paar in den Farbangaben', () => {
  const markup = render()
  assert.match(markup, /data-testid="report-heat"/)
  assert.match(markup, /Gesamt/)
  assert.doesNotMatch(markup, /green/i)
  assert.doesNotMatch(markup, /style="[^"]*(?:red|#f00)/i)
})

test('Verlauf mit Zielwertlinie', () => {
  const markup = render()
  assert.match(markup, /data-testid="report-trend"/)
  assert.match(markup, /Ziel 99,00 %|target 99,00 %/i)
})

test('bei einem Fehler steht der Text statt der Tabellen', () => {
  const markup = render({ data: { ...data, error: 'Die gewählte Gruppe wurde nicht gefunden.' } })
  assert.match(markup, /Die gewählte Gruppe wurde nicht gefunden/)
  assert.doesNotMatch(markup, /data-testid="report-ranking"/)
})

test('die Auswahlfelder zeigen die gesetzten Werte', () => {
  const markup = renderToStaticMarkup(
    <ReportControlsForm
      params={params}
      periodKey="2026-10"
      periodOptions={[{ value: '2026-10', label: 'Oktober 2026' }, { value: 'custom', label: 'Freier Zeitraum' }]}
      groups={[{ id: 1, name: 'Haushalt' }]}
    />,
  )
  assert.match(markup, /<option value="B" selected/)
  assert.match(markup, /<option value="monthly" selected/)
  assert.match(markup, /<option value="7" selected/)
  assert.match(markup, /<option value="2026-10" selected/)
  assert.match(markup, /name="showMaintenance"[^>]*checked/)
})

test('ein Wert knapp unter 100 Prozent erscheint nicht als 100 in der Wärmekarte', () => {
  const heat = { ...data.heat, rows: [{ name: 'Gesamt', values: months.map(() => 99.99596), total: true }] }
  const markup = render({ data: { ...data, heat } })
  const cells = markup.slice(markup.indexOf('data-testid="report-heat"'))
  assert.match(cells, />99,9</)
  assert.doesNotMatch(cells, />100</)
})

test('der Zielstatus nennt den Abstand in Punkten', () => {
  const missed = render({ data: { ...data, kpis: { ...data.kpis, availability: 98.5 } } })
  assert.match(missed, /verfehlt um 0,50 Punkte|missed by 0\.50 points/)
})

test('Wartung als Ausfall (Art B) ohne Störung steht in der Ausfalldauer, nicht als „kein Ausfall“', () => {
  const maintenanceOnly: RankingRow = { ...row('Nur Wartung', 98.65, true), downMs: 600 * MIN, outageCount: 0, longestOutageMs: 0, maintenanceDownMs: 600 * MIN }
  const markup = render({ data: { ...data, ranking: [maintenanceOnly], weakest: [maintenanceOnly] } })
  const ranking = markup.slice(markup.indexOf('data-testid="report-ranking"'))
  assert.doesNotMatch(ranking, /kein Ausfall|no outage/)
  assert.match(ranking, /Wartung|maintenance/i)
})

test('Datumsfelder und die Wahl „Freier Zeitraum“ senden nicht sofort ab, Auswahlfelder schon', () => {
  assert.equal(shouldSubmitOnChange({ type: 'date', name: 'from', value: '2026-1' }), false)
  assert.equal(shouldSubmitOnChange({ type: 'select-one', name: 'period', value: 'custom' }), false)
  assert.equal(shouldSubmitOnChange({ type: 'select-one', name: 'period', value: '2026-10' }), true)
  assert.equal(shouldSubmitOnChange({ type: 'select-one', name: 'maintenance', value: 'B' }), true)
  assert.equal(shouldSubmitOnChange({ type: 'checkbox', name: 'showMaintenance', value: 'true' }), true)
})

test('die Datumsfelder und die Schaltfläche „Anwenden“ stehen immer da', () => {
  const markup = renderToStaticMarkup(
    <ReportControlsForm params={params} periodKey="2026-10" periodOptions={[{ value: '2026-10', label: 'Oktober 2026' }]} groups={[]} />,
  )
  assert.match(markup, /name="from"/)
  assert.match(markup, /name="to"/)
  assert.match(markup, /<button type="submit"/)
})
