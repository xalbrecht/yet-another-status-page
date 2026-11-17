import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Timeline } from '@/lib/availability'
import { computeServiceMetrics } from '@/lib/report/metrics'

const DAY = 24 * 3600_000
const d = (day: number) => Date.UTC(2026, 10, day) // 1.–30.11.2026
const START = d(1)
const END = d(1) + 30 * DAY // 1.12.2026 00:00 (Ende des Zeitraums, offen)

// Der Dienst läuft seit Oktober, Schwerer Ausfall vom 10. bis 20.11.
const timeline: Timeline = [
  { at: Date.UTC(2026, 9, 1), status: 'operational' },
  { at: d(10), status: 'major' },
  { at: d(20), status: 'operational' },
]
const run = (extra: { activeFrom?: number; activeTo?: number | null }) =>
  computeServiceMetrics({ timeline, windows: [], start: START, end: END, mode: 'A', ...extra })

test('ohne Lebenszeit bleibt das Verhalten unverändert: 10 Tage Ausfall in 30 Tagen', () => {
  const metrics = run({})
  assert.equal(metrics.knownMs, 30 * DAY)
  assert.equal(metrics.downMs, 10 * DAY)
})

test('Beginn mitten im Zeitraum: Ausfall zählt nur ab dem Beginn, die Zeit davor ist nicht bekannt', () => {
  const metrics = run({ activeFrom: d(16) })
  assert.equal(metrics.knownMs, 15 * DAY)
  assert.equal(metrics.downMs, 4 * DAY)
  assert.ok(metrics.availability !== null && Math.abs(metrics.availability - (11 / 15) * 100) < 1e-9)
})

test('Ende mitten im Zeitraum: die Zeit danach zählt weder als verfügbar noch als Ausfall', () => {
  const metrics = run({ activeTo: d(10) })
  assert.equal(metrics.knownMs, 9 * DAY)
  assert.equal(metrics.downMs, 0)
  assert.equal(metrics.availability, 100)
})

test('Lebenszeit vollständig außerhalb des Zeitraums: kein Wert', () => {
  assert.deepEqual(run({ activeFrom: END + DAY }), { knownMs: 0, downMs: 0, degradedMs: 0, maintenanceMs: 0, availability: null, outages: [] })
  assert.deepEqual(run({ activeTo: START - DAY }), { knownMs: 0, downMs: 0, degradedMs: 0, maintenanceMs: 0, availability: null, outages: [] })
})

test('Ende leer (null) begrenzt nicht', () => {
  assert.equal(run({ activeFrom: d(1), activeTo: null }).knownMs, 30 * DAY)
})
