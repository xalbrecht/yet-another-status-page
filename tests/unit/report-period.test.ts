import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zonedDateToUtc } from '@/lib/datetime'
import { resolvePeriod } from '@/lib/report/period'

const TZ = 'Europe/Berlin'
const NOW = Date.parse('2026-11-12T10:00:00Z')
const local = (year: number, month: number, day = 1) => zonedDateToUtc({ year, month, day }, TZ).getTime()
const resolve = (input: { period?: string; from?: string; to?: string }, now = NOW) => resolvePeriod(input, now, TZ, 'de-DE')

function ok(input: Parameters<typeof resolve>[0], now = NOW) {
  const result = resolve(input, now)
  assert.ok(result.ok, result.ok ? '' : result.error)
  return result
}

test('Monat: Grenzen in der Zeitzone, Oktober 2026 hat 745 Stunden wegen der Zeitumstellung', () => {
  const { period, previous } = ok({ period: '2026-10' })
  assert.equal(period.start, local(2026, 10))
  assert.equal(period.end, local(2026, 11))
  assert.equal((period.end - period.start) / 3600_000, 745)
  assert.equal(period.partial, false)
  assert.equal(period.label, 'Oktober 2026')
  assert.equal(previous.start, local(2026, 9))
  assert.equal(previous.end, local(2026, 10))
})

test('Quartal, Halbjahr und Jahr mit dem jeweils vorigen Zeitraum', () => {
  const quarter = ok({ period: '2026-Q3' })
  assert.equal(quarter.period.start, local(2026, 7))
  assert.equal(quarter.period.end, local(2026, 10))
  assert.equal(quarter.period.label, 'Q3 2026')
  assert.equal(quarter.previous.start, local(2026, 4))
  assert.equal(quarter.previous.end, local(2026, 7))

  const half = ok({ period: '2026-H1' })
  assert.equal(half.period.start, local(2026, 1))
  assert.equal(half.period.end, local(2026, 7))
  assert.equal(half.previous.start, local(2025, 7))
  assert.equal(half.previous.end, local(2026, 1))

  const year = ok({ period: '2025' })
  assert.equal(year.period.start, local(2025, 1))
  assert.equal(year.period.end, local(2026, 1))
  assert.equal(year.previous.start, local(2024, 1))
})

test('freier Zeitraum: beide Tage eingeschlossen, der vorige Zeitraum ist gleich lang', () => {
  const { period, previous } = ok({ period: 'custom', from: '2026-10-05', to: '2026-10-14' })
  assert.equal(period.start, local(2026, 10, 5))
  assert.equal(period.end, local(2026, 10, 15))
  assert.equal(previous.start, local(2026, 9, 25))
  assert.equal(previous.end, local(2026, 10, 5))
})

test('ohne Angabe gilt der letzte abgeschlossene Monat', () => {
  const { period } = ok({})
  assert.equal(period.start, local(2026, 10))
  assert.equal(period.end, local(2026, 11))
})

test('liegt „jetzt“ im Zeitraum, endet er jetzt und gilt als nicht abgeschlossen', () => {
  const { period, months } = ok({ period: '2026-11' })
  assert.equal(period.start, local(2026, 11))
  assert.equal(period.end, NOW)
  assert.equal(period.partial, true)
  assert.equal(months[months.length - 1].partial, true)
})

test('die 12 Monate des Verlaufs enden mit dem Monat des Zeitraumendes, aufsteigend', () => {
  const month = ok({ period: '2026-10' }).months
  assert.equal(month.length, 12)
  assert.equal(month[0].start, local(2025, 11))
  assert.equal(month[11].start, local(2026, 10))
  assert.equal(month[11].end, local(2026, 11))
  for (let i = 1; i < 12; i++) assert.equal(month[i].start, month[i - 1].end)

  const quarter = ok({ period: '2026-Q3' }).months
  assert.equal(quarter[11].start, local(2026, 9))
})

test('ungültige Eingaben ergeben eine deutsche Fehlermeldung statt einer Ausnahme', () => {
  for (const input of [
    { period: '2026-13' },
    { period: 'abc' },
    { period: '2026-Q5' },
    { period: 'custom', from: '2026-10-05', to: '2026-10-01' },
    { period: 'custom', from: '2026-10-05' },
    { period: 'custom', from: '2026-02-30', to: '2026-03-01' },
    { period: '2027-01' },
  ]) {
    const result = resolve(input)
    assert.equal(result.ok, false, JSON.stringify(input))
    if (!result.ok) assert.ok(result.error.length > 5)
  }
})

test('periodMonths zerlegt einen Zeitraum in Kalendermonate, Randmonate gekürzt', async () => {
  const { periodMonths } = await import('@/lib/report/period')
  const quarter = ok({ period: '2026-Q3' }).period
  const months = periodMonths(quarter, NOW, 'de-DE', TZ)
  assert.equal(months.length, 3)
  assert.equal(months[0].start, local(2026, 7))
  assert.equal(months[2].end, local(2026, 10))

  const custom = ok({ period: 'custom', from: '2026-09-20', to: '2026-10-10' }).period
  const parts = periodMonths(custom, NOW, 'de-DE', TZ)
  assert.equal(parts.length, 2)
  assert.equal(parts[0].start, local(2026, 9, 20))
  assert.equal(parts[0].end, local(2026, 10))
  assert.equal(parts[1].start, local(2026, 10))
  assert.equal(parts[1].end, local(2026, 10, 11))

  const current = ok({ period: '2026-11' }).period
  const open = periodMonths(current, NOW, 'de-DE', TZ)
  assert.equal(open.length, 1)
  assert.equal(open[0].end, NOW)
  assert.equal(open[0].partial, true)
})

test('periodOptions bietet Monate, Quartale, Halbjahre, Jahre und den freien Zeitraum an', async () => {
  const { periodOptions } = await import('@/lib/report/period')
  const options = periodOptions(NOW, TZ, 'de-DE')
  const values = options.map((option) => option.value)
  assert.ok(values.includes('2026-10'))
  assert.ok(values.includes('2026-11'))
  assert.ok(values.includes('2026-Q3'))
  assert.ok(values.includes('2026-H1'))
  assert.ok(values.includes('2026'))
  assert.equal(values[values.length - 1], 'custom')
  assert.equal(options.find((option) => option.value === '2026-10')?.label, 'Oktober 2026')
  assert.equal(values.filter((value) => /^\d{4}-\d{2}$/.test(value)).length, 12)
})

test('reportDataEnd lädt Daten bis zum Ende des letzten Monats des Verlaufs, auch bei freiem Zeitraum mitten im Monat', async () => {
  const { reportDataEnd } = await import('@/lib/report/period')
  const mid = ok({ period: 'custom', from: '2026-10-01', to: '2026-10-15' })
  assert.equal(reportDataEnd(mid.period, mid.months), local(2026, 11))
  const month = ok({ period: '2026-10' })
  assert.equal(reportDataEnd(month.period, month.months), local(2026, 11))
  const current = ok({ period: '2026-11' })
  assert.equal(reportDataEnd(current.period, current.months), NOW)
})
