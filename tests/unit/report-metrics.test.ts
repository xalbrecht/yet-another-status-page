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
