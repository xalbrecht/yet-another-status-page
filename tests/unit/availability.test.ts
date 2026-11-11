import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeAvailability,
  computeStatusDurations,
  formatAvailability,
  knownSince,
  worstStatus,
  type Timeline,
} from '@/lib/availability'

const H = 3600_000
const t0 = Date.parse('2026-11-10T15:56:00Z')

const near = (actual: number | null, expected: number) => {
  assert.ok(actual !== null && Math.abs(actual - expected) < 1e-9, `erwartet ${expected}, erhalten ${actual}`)
}

const partialOutage: Timeline = [
  { at: t0, status: 'operational' },
  { at: t0 + 10 * H, status: 'partial' },
  { at: t0 + 12 * H, status: 'operational' },
]

test('Verfügbarkeit: 2 Stunden Teilausfall in 24 Stunden ergeben 91,67 Prozent', () => {
  const value = computeAvailability(partialOutage, t0, t0 + 24 * H)
  near(value, 91.6666666667)
  assert.equal(formatAvailability(value, 'de-DE'), '91,66 %')
})

test('Verfügbarkeit: Zeit vor dem ersten Eintrag ist unbekannt und zählt nicht', () => {
  near(computeAvailability(partialOutage, t0 - 24 * H, t0 + 24 * H), 91.6666666667)
  assert.equal(knownSince(partialOutage, t0 - 24 * H, t0 + 24 * H), t0)
  assert.equal(knownSince(partialOutage, t0, t0 + 24 * H), t0)
})

test('Verfügbarkeit: ohne bekannten Zustand ist der Wert null und der Text leer', () => {
  assert.equal(computeAvailability([], t0, t0 + H), null)
  assert.equal(computeAvailability(partialOutage, t0 - 48 * H, t0 - 24 * H), null)
  assert.equal(formatAvailability(null, 'de-DE'), '')
})

test('Eingeschränkt und Wartung zählen als verfügbar, die Dauer je Status wird getrennt gezählt', () => {
  const timeline: Timeline = [
    { at: t0, status: 'operational' },
    { at: t0 + H, status: 'degraded' },
    { at: t0 + 2 * H, status: 'maintenance' },
    { at: t0 + 3 * H, status: 'operational' },
  ]
  assert.equal(computeAvailability(timeline, t0, t0 + 4 * H), 100)
  assert.deepEqual(computeStatusDurations(timeline, t0, t0 + 4 * H), {
    knownMs: 4 * H,
    byStatus: { operational: 2 * H, degraded: H, maintenance: H, partial: 0, major: 0 },
  })
})

test('Anzeige rundet ab: 99,996 Prozent erscheint nicht als 100,00', () => {
  assert.equal(formatAvailability(99.996, 'de-DE'), '99,99 %')
})

test('schlechtester Zustand', () => {
  assert.equal(worstStatus(['operational', 'maintenance', 'degraded']), 'degraded')
  assert.equal(worstStatus([null, undefined]), null)
  assert.equal(worstStatus(['partial', 'major']), 'major')
})
