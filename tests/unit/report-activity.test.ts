import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Timeline } from '@/lib/availability'
import { buildGroupList, buildReport, type ReportInput } from '@/lib/report/aggregate'
import { parseReportParams } from '@/lib/report/params'
import { endOfZonedDay, startOfZonedDay } from '@/lib/datetime'
import { resolvePeriod } from '@/lib/report/period'

const TZ = 'Europe/Berlin'
const LOCALE = 'de-DE'
const NOW = Date.parse('2026-11-17T10:00:00Z')
const ANCHOR = Date.parse('2025-05-05T00:00:00Z')
// Tagesgrenzen in der Zeitzone der Installation, wie sie die Felder speichern (Beginn: Tagesanfang, Ende: Tagesende)
const dayStart = (month: number, d: number) => startOfZonedDay(new Date(Date.UTC(2026, month - 1, d, 12)), TZ).getTime()
const dayEnd = (month: number, d: number) => endOfZonedDay(new Date(Date.UTC(2026, month - 1, d, 12)), TZ).getTime()

// Ausfall (Teilausfall) vom 10. bis 20.10.2026
const timeline: Timeline = [
  { at: ANCHOR, status: 'operational' },
  { at: dayStart(10, 10), status: 'partial' },
  { at: dayStart(10, 20), status: 'operational' },
]

type Svc = ReportInput['services'][number]
const svc = (id: number, name: string, lifetime: { startsAt?: number; endsAt?: number | null }): Svc => ({ id, name, groupId: 1, timeline, windows: [], ...lifetime })

const build = (services: Svc[]): ReportInput => {
  const resolved = resolvePeriod({ period: '2026-10' }, NOW, TZ, LOCALE)
  assert.ok(resolved.ok)
  return {
    period: resolved.period,
    previous: resolved.previous,
    months: resolved.months,
    params: parseReportParams({}),
    globalTarget: 99,
    groups: [{ id: 1, name: 'Gruppe 1' }],
    services,
    footnotes: { unsure: 0, withoutService: 0 },
    now: NOW,
    timeZone: TZ,
    locale: LOCALE,
  }
}

// Berichtszeitraum Oktober 2026, Berichtsdatum 17.11.2026
const services = [
  svc(1, 'A ganzer Zeitraum', { startsAt: dayStart(1, 1) }),
  svc(2, 'B Beginn 16.10.', { startsAt: dayStart(10, 16) }),
  svc(3, 'C Ende 10.10.', { startsAt: dayStart(1, 1), endsAt: dayEnd(10, 10) }),
  svc(4, 'D Ende 30.09.', { startsAt: dayStart(1, 1), endsAt: dayEnd(9, 30) }),
]

test('Aktiv im Berichtszeitraum: ja, wenn die Lebenszeit den Zeitraum berührt', () => {
  const data = buildReport(build(services))
  const flag = (name: string) => data.ranking.find((row) => row.name.startsWith(name))?.activeInPeriod
  assert.equal(flag('A'), true)
  assert.equal(flag('B'), true)
  assert.equal(flag('C'), true)
  assert.equal(flag('D'), false)
})

test('Aktiv heute bezieht sich auf das Berichtsdatum, endedAt nennt das Ende beendeter Dienste', () => {
  const data = buildReport(build(services))
  const row = (name: string) => data.ranking.find((entry) => entry.name.startsWith(name))!
  assert.equal(row('A').activeToday, true)
  assert.equal(row('B').activeToday, true)
  assert.equal(row('C').activeToday, false)
  assert.equal(row('D').activeToday, false)
  assert.equal(row('A').endedAt, null)
  assert.equal(row('C').endedAt, dayEnd(10, 10))
})

test('ein Dienst ohne Berührung des Zeitraums hat keinen Wert und geht in keinen Mittelwert ein', () => {
  const data = buildReport(build(services))
  const row = (name: string) => data.ranking.find((entry) => entry.name.startsWith(name))!
  assert.equal(row('D').availability, null)
  const known = ['A', 'B', 'C'].map((name) => row(name).availability as number)
  assert.ok(known.every((value) => value !== null))
  const expected = known.reduce((sum, value) => sum + value, 0) / known.length
  assert.ok(Math.abs((data.kpis.availability as number) - expected) < 1e-9)
})

test('die Auswertung gilt nur für die Lebenszeit: B zählt den Ausfall ab dem 16.10., C endet vor dem Ende des Ausfalls', () => {
  const data = buildReport(build(services))
  const row = (name: string) => data.ranking.find((entry) => entry.name.startsWith(name))!
  const dayMs = 24 * 3600_000
  assert.equal(row('A').downMs, 10 * dayMs)
  assert.equal(row('B').downMs, 4 * dayMs)
  assert.equal(row('C').downMs, 1 * dayMs) // nur der 10.10.: Der Endtag zählt noch voll mit
})

test('die Zahl der Dienste im Bericht zählt nur Dienste, die im Zeitraum aktiv waren', () => {
  const data = buildReport(build(services))
  assert.equal(data.kpis.serviceCount, 3)
  assert.equal(data.scope.serviceCount, 3)
  assert.equal(data.groupList[0].serviceCount, 3)
  assert.equal(buildGroupList(build(services))[0].serviceCount, 3)
})

test('ohne Beginn und Ende (ältere Eingabe) gilt der Dienst als immer aktiv', () => {
  const data = buildReport(build([svc(9, 'Ohne Angaben', {})]))
  assert.equal(data.ranking[0].activeInPeriod, true)
  assert.equal(data.ranking[0].activeToday, true)
  assert.equal(data.ranking[0].endedAt, null)
})
