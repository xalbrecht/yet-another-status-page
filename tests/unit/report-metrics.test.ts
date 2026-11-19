import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatAvailability, type Timeline } from '@/lib/availability'
import { computeServiceMetrics } from '@/lib/report/metrics'

const MIN = 60_000
const start = Date.parse('2026-10-01T00:00:00Z')
const end = start + 44_640 * MIN // 31 Tage
const at = (minutes: number) => start + minutes * MIN
const near = (actual: number | null, expected: number) =>
  assert.ok(actual !== null && Math.abs(actual - expected) < 1e-3, `erwartet ${expected}, erhalten ${actual}`)

// Störung 90 Minuten außerhalb der Wartung, Wartung 600 Minuten (Minute 10.000 bis 10.600), darin 30 Minuten Störung
const timeline: Timeline = [
  { at: start, status: 'operational' },
  { at: at(1_000), status: 'partial' },
  { at: at(1_090), status: 'operational' },
  { at: at(10_100), status: 'partial' },
  { at: at(10_130), status: 'operational' },
]
const windows = [{ from: at(10_000), to: at(10_600) }]

test('Art A: Wartung zählt als verfügbar, Störungen in der Wartung zählen nicht', () => {
  const metrics = computeServiceMetrics({ timeline, windows, start, end, mode: 'A' })
  near(metrics.availability, 99.7984)
  assert.equal(formatAvailability(metrics.availability, 'de-DE'), '99,79 %')
  assert.equal(metrics.downMs, 90 * MIN)
  assert.equal(metrics.maintenanceMs, 600 * MIN)
})

test('Art B: Wartung zählt als Ausfall, die Störung darin wird nicht doppelt gezählt', () => {
  const metrics = computeServiceMetrics({ timeline, windows, start, end, mode: 'B' })
  near(metrics.availability, 98.4543)
  assert.equal(formatAvailability(metrics.availability, 'de-DE'), '98,45 %')
  assert.equal(metrics.downMs, 690 * MIN)
  assert.equal(metrics.maintenanceMs, 600 * MIN)
})

test('Art C: Wartung ist aus der Gesamtzeit herausgenommen', () => {
  const metrics = computeServiceMetrics({ timeline, windows, start, end, mode: 'C' })
  near(metrics.availability, 99.7956)
  assert.equal(formatAvailability(metrics.availability, 'de-DE'), '99,79 %')
  assert.equal(metrics.knownMs, 44_040 * MIN)
  assert.equal(metrics.downMs, 90 * MIN)
})

test('Ausfälle: nur die Störung außerhalb der Wartung, zusammengefasst', () => {
  for (const mode of ['A', 'B', 'C'] as const) {
    const { outages } = computeServiceMetrics({ timeline, windows, start, end, mode })
    assert.deepEqual(outages, [{ from: at(1_000), to: at(1_090), status: 'partial' }], mode)
  }
})

test('aneinandergrenzende Ausfälle werden zusammengefasst, der schwerere Zustand gilt', () => {
  const metrics = computeServiceMetrics({
    timeline: [
      { at: start, status: 'operational' },
      { at: at(100), status: 'partial' },
      { at: at(160), status: 'major' },
      { at: at(200), status: 'operational' },
    ],
    windows: [],
    start,
    end,
    mode: 'A',
  })
  assert.deepEqual(metrics.outages, [{ from: at(100), to: at(200), status: 'major' }])
})

test('ohne bekannten Zustand ist der Wert null (nicht 100 Prozent)', () => {
  const metrics = computeServiceMetrics({ timeline: [], windows: [], start, end, mode: 'A' })
  assert.equal(metrics.availability, null)
  assert.equal(metrics.knownMs, 0)
  const later = computeServiceMetrics({ timeline: [{ at: end + 1, status: 'operational' }], windows: [], start, end, mode: 'A' })
  assert.equal(later.availability, null)
})

test('Zeit vor dem ersten Eintrag ist unbekannt und zählt nicht', () => {
  const metrics = computeServiceMetrics({
    timeline: [{ at: at(22_320), status: 'operational' }],
    windows: [],
    start,
    end,
    mode: 'A',
  })
  assert.equal(metrics.knownMs, 22_320 * MIN)
  assert.equal(metrics.availability, 100)
})

test('ein Wartungsfenster über das Ende des Zeitraums hinaus wird gekürzt', () => {
  const metrics = computeServiceMetrics({
    timeline: [{ at: start, status: 'operational' }],
    windows: [{ from: end - 60 * MIN, to: end + 500 * MIN }],
    start,
    end,
    mode: 'B',
  })
  assert.equal(metrics.maintenanceMs, 60 * MIN)
  assert.equal(metrics.downMs, 60 * MIN)
})

test('Eingeschränkt zählt als verfügbar und steht als eigene Zeit', () => {
  const metrics = computeServiceMetrics({
    timeline: [
      { at: start, status: 'operational' },
      { at: at(100), status: 'degraded' },
      { at: at(280), status: 'operational' },
    ],
    windows: [],
    start,
    end,
    mode: 'A',
  })
  assert.equal(metrics.degradedMs, 180 * MIN)
  assert.equal(metrics.availability, 100)
})

test('der Zustand „Wartung“ im Protokoll ohne Wartungsfenster zählt nicht als Wartungszeit', () => {
  const metrics = computeServiceMetrics({
    timeline: [
      { at: start, status: 'operational' },
      { at: at(100), status: 'maintenance' },
      { at: at(400), status: 'operational' },
    ],
    windows: [],
    start,
    end,
    mode: 'B',
  })
  assert.equal(metrics.maintenanceMs, 0)
  assert.equal(metrics.availability, 100)
})

// Prüfbeispiel aus Issue #216: Woche mit 168 Stunden, 4 Stunden Wartung im Fenster (darin 1 Stunde Teilausfall), 2 Stunden zusätzlich
const HOUR = 60 * MIN
const weekStart = Date.parse('2026-10-05T00:00:00Z')
const weekEnd = weekStart + 168 * HOUR
const hour = (n: number) => weekStart + n * HOUR
const weekTimeline: Timeline = [
  { at: weekStart, status: 'operational' },
  { at: hour(21), status: 'partial' },
  { at: hour(22), status: 'operational' },
]
const kindWindows = [
  { from: hour(20), to: hour(24), kind: 'sla' as const },
  { from: hour(100), to: hour(102), kind: 'additional' as const },
]
const week = (sla: 'A' | 'B' | 'C', additional: 'A' | 'B' | 'C') =>
  computeServiceMetrics({ timeline: weekTimeline, windows: kindWindows, start: weekStart, end: weekEnd, mode: { sla, additional } })

test('Wartungsarten: Woche mit 4 h im Fenster und 2 h zusätzlich, A/A 100,00 %', () => {
  const metrics = week('A', 'A')
  assert.equal(formatAvailability(metrics.availability, 'de-DE'), '100,00 %')
  assert.equal(metrics.downMs, 0)
})

test('Wartungsarten: A im Fenster, B zusätzlich: 2 h Ausfall, 98,81 % (gerundet)', () => {
  const metrics = week('A', 'B')
  // 98,8095 %: kaufmännisch 98,81 %. Die Anzeige rundet ab (formatAvailability) und zeigt 98,80 %.
  near(metrics.availability, 98.8095)
  assert.equal(metrics.downMs, 2 * HOUR)
})

test('Wartungsarten: B für beide: 6 h Ausfall, 96,43 % (gerundet), die Störung im Fenster zählt nicht doppelt', () => {
  const metrics = week('B', 'B')
  // 96,4286 %: kaufmännisch 96,43 %. Die Anzeige rundet ab und zeigt 96,42 %.
  near(metrics.availability, 96.4286)
  assert.equal(metrics.downMs, 6 * HOUR)
})

test('Wartungsarten: die Wartungszeit wird je Art getrennt ausgewiesen', () => {
  const metrics = week('A', 'A')
  assert.equal(metrics.maintenanceMs, 6 * HOUR)
  assert.deepEqual(metrics.maintenanceByKind, { sla: 4 * HOUR, additional: 2 * HOUR })
})

test('Wartungsarten: C je Art nimmt nur die Zeit dieser Art aus der Gesamtzeit', () => {
  const metrics = week('C', 'A')
  assert.equal(metrics.knownMs, 164 * HOUR)
  assert.equal(metrics.downMs, 0)
})

test('Wartungsarten: überlappen sich die Fenster, gilt die zusätzliche Wartung', () => {
  // zusätzlich 22:00 bis 26:00 überlappt das Fenster 20:00 bis 24:00 um 2 Stunden
  const metrics = computeServiceMetrics({
    timeline: [{ at: weekStart, status: 'operational' }],
    windows: [
      { from: hour(20), to: hour(24), kind: 'sla' },
      { from: hour(22), to: hour(26), kind: 'additional' },
    ],
    start: weekStart,
    end: weekEnd,
    mode: { sla: 'A', additional: 'B' },
  })
  assert.deepEqual(metrics.maintenanceByKind, { sla: 2 * HOUR, additional: 4 * HOUR })
  assert.equal(metrics.maintenanceMs, 6 * HOUR)
  assert.equal(metrics.downMs, 4 * HOUR)
})

test('Wartungsarten: ein einzelner Modus gilt für beide Arten, Fenster ohne Art zählen als Fenster (SLA)', () => {
  const single = computeServiceMetrics({ timeline: weekTimeline, windows: kindWindows, start: weekStart, end: weekEnd, mode: 'B' })
  assert.equal(single.downMs, 6 * HOUR)
  const untyped = computeServiceMetrics({ timeline, windows, start, end, mode: 'A' })
  assert.deepEqual(untyped.maintenanceByKind, { sla: 600 * MIN, additional: 0 })
})
