import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Timeline } from '@/lib/availability'
import { buildReport, type ReportInput } from '@/lib/report/aggregate'
import { parseReportParams } from '@/lib/report/params'
import { periodMonths, resolvePeriod } from '@/lib/report/period'

const TZ = 'Europe/Berlin'
const LOCALE = 'de-DE'
const NOW = Date.parse('2027-01-05T10:00:00Z')
const ANCHOR = Date.parse('2025-05-05T00:00:00Z')

const near = (actual: number | null, expected: number, tolerance = 1e-6) =>
  assert.ok(actual !== null && Math.abs(actual - expected) < tolerance, `erwartet ${expected}, erhalten ${actual}`)

/** Zeitleiste: betriebsbereit, dazwischen Teilausfälle in den angegebenen Abschnitten. */
const timelineWith = (outages: Array<[number, number]>): Timeline => {
  const result: Timeline = [{ at: ANCHOR, status: 'operational' }]
  for (const [from, to] of outages) {
    result.push({ at: from, status: 'partial' }, { at: to, status: 'operational' })
  }
  return result
}

function input(
  periodKey: string,
  services: ReportInput['services'],
  options: { groups?: ReportInput['groups']; params?: Record<string, string>; globalTarget?: number } = {},
): ReportInput {
  const resolved = resolvePeriod({ period: periodKey }, NOW, TZ, LOCALE)
  assert.ok(resolved.ok)
  return {
    period: resolved.period,
    previous: resolved.previous,
    months: resolved.months,
    params: parseReportParams(options.params ?? {}),
    globalTarget: options.globalTarget ?? 99,
    groups: options.groups ?? [{ id: 1, name: 'Gruppe 1' }],
    services,
    footnotes: { unsure: 78, withoutService: 19 },
    now: NOW,
    timeZone: TZ,
    locale: LOCALE,
  }
}

const service = (id: number, name: string, timeline: Timeline, extra: Partial<ReportInput['services'][number]> = {}) => ({
  id,
  name,
  groupId: 1,
  timeline,
  windows: [],
  ...extra,
})

const octoberLength = (() => {
  const resolved = resolvePeriod({ period: '2026-10' }, NOW, TZ, LOCALE)
  assert.ok(resolved.ok)
  return { start: resolved.period.start, ms: resolved.period.end - resolved.period.start }
})()

test('Gruppenwert ist der Mittelwert der Dienste, jeder gleich gewichtet', () => {
  const data = buildReport(
    input('2026-10', [
      service(1, 'A', timelineWith([])),
      service(2, 'B', timelineWith([[octoberLength.start, octoberLength.start + octoberLength.ms * 0.02]])),
    ]),
  )
  near(data.kpis.availability, 99)
  const row = data.heat.rows.find((entry) => entry.name === 'Gruppe 1')
  assert.ok(row)
  near(row.values[11], 99)
  assert.equal(data.kpis.serviceCount, 2)
  assert.equal(data.kpis.affectedServices, 1)
})

test('Rechenart 2 ist das Mittel der Monatswerte, Rechenart 1 ein Wert für den Zeitraum', () => {
  const resolved = resolvePeriod({ period: '2026-Q1' }, NOW, TZ, LOCALE)
  assert.ok(resolved.ok)
  const months = periodMonths(resolved.period, NOW, LOCALE, TZ)
  const february = months[1]
  const outage: [number, number] = [february.start, february.start + (february.end - february.start) * 0.1]
  const services = [service(1, 'A', timelineWith([outage]))]

  const whole = buildReport(input('2026-Q1', services, { params: { calc: 'whole' } }))
  const monthly = buildReport(input('2026-Q1', services, { params: { calc: 'monthly' } }))
  const quarterMs = resolved.period.end - resolved.period.start
  near(whole.kpis.availability, (1 - (outage[1] - outage[0]) / quarterMs) * 100)
  near(monthly.kpis.availability, (100 + 90 + 100) / 3)
  assert.notEqual(whole.kpis.availability, monthly.kpis.availability)
})

test('Monate mit erreichtem Ziel: 8 von 12, wenn in 4 Monaten der Wert unter 99 liegt', () => {
  const resolved = resolvePeriod({ period: '2026' }, NOW, TZ, LOCALE)
  assert.ok(resolved.ok)
  const months = periodMonths(resolved.period, NOW, LOCALE, TZ)
  const outages = [2, 5, 7, 8].map((index): [number, number] => [months[index].start, months[index].start + (months[index].end - months[index].start) * 0.02])
  const data = buildReport(input('2026', [service(1, 'A', timelineWith(outages))]))
  assert.equal(data.kpis.monthsMet, 8)
  assert.equal(data.kpis.monthsTotal, 12)
  assert.equal(data.kpis.target, 99)
})

test('der Zielwert wird aus Dienst, Gruppe und Gesamt aufgelöst', () => {
  const outage: [number, number] = [octoberLength.start, octoberLength.start + octoberLength.ms * 0.015]
  const services = [service(1, 'A', timelineWith([outage]))]
  const withGroupTarget = buildReport(input('2026-10', services, { groups: [{ id: 1, name: 'Gruppe 1', target: 98 }] }))
  assert.equal(withGroupTarget.ranking[0].target, 98)
  assert.equal(withGroupTarget.ranking[0].belowTarget, false)
  const withoutGroupTarget = buildReport(input('2026-10', services))
  assert.equal(withoutGroupTarget.ranking[0].target, 99)
  assert.equal(withoutGroupTarget.ranking[0].belowTarget, true)
  const ownTarget = buildReport(input('2026-10', [service(1, 'A', timelineWith([outage]), { target: 97 })], { groups: [{ id: 1, name: 'Gruppe 1', target: 98 }] }))
  assert.equal(ownTarget.ranking[0].target, 97)
})

test('schwächste Dienste: höchstens die gewählte Anzahl, nur mit Ausfall, schwächster zuerst', () => {
  const services = [
    service(1, 'ohne Ausfall', timelineWith([])),
    ...[1, 2, 3, 4, 5].map((n) => service(10 + n, `Ausfall ${n}`, timelineWith([[octoberLength.start, octoberLength.start + octoberLength.ms * 0.01 * n]]))),
  ]
  const three = buildReport(input('2026-10', services, { params: { topN: '3' } }))
  assert.deepEqual(three.weakest.map((row) => row.name), ['Ausfall 5', 'Ausfall 4', 'Ausfall 3'])
  const many = buildReport(input('2026-10', services, { params: { topN: '10' } }))
  assert.equal(many.weakest.length, 5)
  assert.ok(many.weakest.every((row) => row.outageCount > 0))
  assert.equal(many.ranking.length, 6)
  assert.equal(many.ranking[5].name, 'ohne Ausfall')
})

test('Gruppenauswahl zeigt die Dienste der Gruppe, eine unbekannte Gruppe ergibt einen Fehler', () => {
  const services = [service(1, 'A', timelineWith([])), service(2, 'B', timelineWith([]), { groupId: 2 })]
  const groups = [{ id: 1, name: 'Gruppe 1' }, { id: 2, name: 'Gruppe 2' }]
  const selected = buildReport(input('2026-10', services, { groups, params: { group: '2' } }))
  assert.equal(selected.error, undefined)
  assert.equal(selected.kpis.serviceCount, 1)
  assert.deepEqual(selected.heat.rows.filter((row) => !row.total).map((row) => row.name), ['B'])
  assert.deepEqual(selected.ranking.map((row) => row.name), ['B'])

  const unknown = buildReport(input('2026-10', services, { groups, params: { group: '99' } }))
  assert.ok(unknown.error && unknown.error.length > 5)
})

test('Verlauf und Wärmekarte haben 12 Monate, die Gesamtzeile steht zuerst', () => {
  const data = buildReport(input('2026-10', [service(1, 'A', timelineWith([]))]))
  assert.equal(data.trend.length, 12)
  assert.equal(data.heat.columns.length, 12)
  assert.equal(data.heat.rows[0].total, true)
  assert.equal(data.heat.rows[0].values.length, 12)
})

test('ein Dienst ohne bekannte Zeit hat den Wert null, steht am Ende und zählt nicht in den Mittelwert', () => {
  const data = buildReport(input('2026-10', [service(1, 'A', timelineWith([])), service(2, 'neu', [])]))
  near(data.kpis.availability, 100)
  assert.equal(data.ranking[1].availability, null)
  assert.equal(data.ranking[1].name, 'neu')
})

test('Wartungsart wirkt auf den Wert, die Wartungszeit steht als eigene Kennzahl', () => {
  const window = { from: octoberLength.start, to: octoberLength.start + octoberLength.ms * 0.1 }
  const services = [service(1, 'A', timelineWith([]), { windows: [window] })]
  const modeA = buildReport(input('2026-10', services, { params: { maintenance: 'A' } }))
  const modeB = buildReport(input('2026-10', services, { params: { maintenance: 'B' } }))
  near(modeA.kpis.availability, 100)
  near(modeB.kpis.availability, 90)
  near(modeA.kpis.maintenanceMs / octoberLength.ms, 0.1)
})

test('Fußnoten werden durchgereicht', () => {
  const data = buildReport(input('2026-10', [service(1, 'A', timelineWith([]))]))
  assert.deepEqual(data.footnotes, { unsure: 78, withoutService: 19 })
})
