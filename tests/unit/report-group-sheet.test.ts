import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Timeline } from '@/lib/availability'
import { buildGroupSheet, splitOutageByDay } from '@/lib/report/group-sheet'

const HOUR = 3_600_000
const Z = 'Europe/Berlin'
const ms = (iso: string) => Date.parse(iso)

// Oktober 2026 in Berlin: 31 Tage, Zeitumstellung am 25.10. (Sommerzeit endet um 03:00)
const month = { key: '2026-10', label: 'Oktober 2026', start: ms('2026-09-30T22:00:00Z'), end: ms('2026-10-31T23:00:00Z'), partial: false }
const serviceOf = (id: number, name: string, timeline: Timeline) => ({ id, name, timeline, windows: [] })
const baseline = { at: ms('2026-09-01T00:00:00Z'), status: 'operational' as const }

test('splitOutageByDay teilt einen Ausfall über Mitternacht in zwei Tage', () => {
  const parts = splitOutageByDay({ from: ms('2026-10-24T21:00:00Z'), to: ms('2026-10-24T23:00:00Z') }, Z)
  assert.deepEqual(parts, [
    { day: '2026-10-24', ms: HOUR },
    { day: '2026-10-25', ms: HOUR },
  ])
})

test('splitOutageByDay rechnet über die Zeitumstellung richtig und behält die Summe', () => {
  const parts = splitOutageByDay({ from: ms('2026-10-25T00:00:00Z'), to: ms('2026-10-26T00:00:00Z') }, Z)
  assert.deepEqual(parts.map((part) => part.day), ['2026-10-25', '2026-10-26'])
  assert.equal(parts.reduce((sum, part) => sum + part.ms, 0), 24 * HOUR)
  assert.ok(parts.every((part) => part.ms > 0))
})

test('splitOutageByDay liefert für einen Ausfall innerhalb eines Tages einen Eintrag', () => {
  const parts = splitOutageByDay({ from: ms('2026-10-12T08:00:00Z'), to: ms('2026-10-12T10:00:00Z') }, Z)
  assert.deepEqual(parts, [{ day: '2026-10-12', ms: 2 * HOUR }])
})

test('splitOutageByDay liefert für einen leeren Ausfall keinen Eintrag', () => {
  assert.deepEqual(splitOutageByDay({ from: 5, to: 5 }, Z), [])
})

const mach: Timeline = [
  baseline,
  { at: ms('2026-10-12T08:00:00Z'), status: 'partial' }, // 12.10. 10:00 bis 12:00 Ortszeit
  { at: ms('2026-10-12T10:00:00Z'), status: 'operational' },
  { at: ms('2026-10-13T06:00:00Z'), status: 'major' }, // 13.10. 08:00 bis 09:30 Ortszeit
  { at: ms('2026-10-13T07:30:00Z'), status: 'operational' },
]

test('buildGroupSheet summiert Teilausfall und Schwerer Ausfall je Dienst', () => {
  const sheet = buildGroupSheet({ month, services: [serviceOf(1, 'MACH', mach)], mode: 'A', timeZone: Z })
  assert.equal(sheet.month.key, '2026-10')
  assert.equal(sheet.perService.length, 1)
  assert.deepEqual(
    { name: sheet.perService[0].name, partialMs: sheet.perService[0].partialMs, majorMs: sheet.perService[0].majorMs },
    { name: 'MACH', partialMs: 2 * HOUR, majorMs: 1.5 * HOUR },
  )
})

test('buildGroupSheet führt jeden Tag des Monats auf und ordnet die Balken den Tagen zu', () => {
  const sheet = buildGroupSheet({ month, services: [serviceOf(1, 'MACH', mach)], mode: 'A', timeZone: Z })
  assert.equal(sheet.perDay.length, 31)
  const day12 = sheet.perDay[11]
  assert.equal(day12.day, '2026-10-12')
  assert.equal(day12.dayOfMonth, 12)
  assert.deepEqual(day12.bars, [{ serviceId: 1, name: 'MACH', status: 'partial', ms: 2 * HOUR }])
  assert.deepEqual(sheet.perDay[12].bars, [{ serviceId: 1, name: 'MACH', status: 'major', ms: 1.5 * HOUR }])
  const others = sheet.perDay.filter((_, index) => index !== 11 && index !== 12)
  assert.ok(others.every((day) => day.bars.length === 0))
})

test('buildGroupSheet sortiert die Balken eines Tages absteigend nach Dauer', () => {
  const short: Timeline = [baseline, { at: ms('2026-10-15T08:00:00Z'), status: 'partial' }, { at: ms('2026-10-15T08:30:00Z'), status: 'operational' }]
  const long: Timeline = [baseline, { at: ms('2026-10-15T09:00:00Z'), status: 'major' }, { at: ms('2026-10-15T10:30:00Z'), status: 'operational' }]
  const sheet = buildGroupSheet({ month, services: [serviceOf(1, 'Kurz', short), serviceOf(2, 'Lang', long)], mode: 'A', timeZone: Z })
  assert.deepEqual(sheet.perDay[14].bars.map((bar) => bar.name), ['Lang', 'Kurz'])
  assert.deepEqual(sheet.perService.map((entry) => entry.name), ['Lang', 'Kurz'])
})

test('buildGroupSheet führt einen Dienst nur mit Einschränkung in perService, aber ohne Balken', () => {
  const degraded: Timeline = [baseline, { at: ms('2026-10-05T08:00:00Z'), status: 'degraded' }, { at: ms('2026-10-05T10:00:00Z'), status: 'operational' }]
  const sheet = buildGroupSheet({ month, services: [serviceOf(1, 'Langsam', degraded)], mode: 'A', timeZone: Z })
  assert.equal(sheet.perService.length, 1)
  assert.equal(sheet.perService[0].degradedMs, 2 * HOUR)
  assert.ok(sheet.perDay.every((day) => day.bars.length === 0))
})

test('buildGroupSheet lässt einen Dienst ohne Störung aus', () => {
  const sheet = buildGroupSheet({ month, services: [serviceOf(1, 'Ruhig', [baseline])], mode: 'A', timeZone: Z })
  assert.deepEqual(sheet.perService, [])
})

test('buildGroupSheet endet im laufenden Monat mit dem heutigen Tag', () => {
  const running = { ...month, end: ms('2026-10-14T10:00:00Z'), partial: true }
  const sheet = buildGroupSheet({ month: running, services: [serviceOf(1, 'MACH', mach)], mode: 'A', timeZone: Z })
  assert.equal(sheet.perDay.length, 14)
  assert.equal(sheet.perDay[13].dayOfMonth, 14)
})
