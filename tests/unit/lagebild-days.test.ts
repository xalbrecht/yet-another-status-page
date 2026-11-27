import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_DATETIME_CONFIG, formatDateSlug, type DateTimeConfig } from '@/lib/datetime'
import { computePeriods, lagebildDays, PERIOD_OPTIONS, type Timeline } from '@/lib/lagebild'

const DAY = 24 * 3600_000
const NOW = Date.UTC(2026, 10, 27, 10, 0, 0)
const berlin: DateTimeConfig = { ...DEFAULT_DATETIME_CONFIG, timezone: 'Europe/Berlin', locale: 'de-DE' }

test('ein Zustand, der das ganze Fenster abdeckt, liegt auf einem Tag der Liste (#283)', () => {
  for (const periodDays of PERIOD_OPTIONS) {
    // Dienst wechselte lange vor dem Fenster auf „Schwerer Ausfall“ und blieb dort
    const timeline: Timeline = [{ at: NOW - (periodDays + 6) * DAY, status: 'major' }]
    const periods = computePeriods([timeline], NOW, periodDays)
    assert.equal(periods.length, 1, `Rückschau ${periodDays} Tage`)
    const days = lagebildDays(NOW, periodDays, berlin).map((day) => day.dayKey)
    const key = formatDateSlug(new Date(periods[0].start), berlin.timezone)
    assert.ok(days.includes(key), `Rückschau ${periodDays} Tage: ${key} fehlt in ${days[days.length - 1]} … ${days[0]}`)
  }
})

test('die Liste nennt heute zuerst und den Tag des Fensteranfangs zuletzt, ohne Lücke', () => {
  const days = lagebildDays(NOW, 14, berlin)
  assert.equal(days.length, 15)
  assert.equal(days[0].dayKey, '2026-11-27')
  assert.equal(days[14].dayKey, '2026-11-13')
  assert.equal(new Set(days.map((day) => day.dayKey)).size, 15)
  assert.ok(days.every((day) => day.dayLabel.length > 0))
})
