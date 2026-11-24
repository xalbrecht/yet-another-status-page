import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import { loadReportContext, loadReport } from '@/lib/report/load'

const NOW = Date.parse('2026-11-17T10:00:00Z')
const DAY = 24 * 3600_000
const long = new Date(NOW - 300 * DAY).toISOString()

// Gruppe 1 mit Dienst 1 (immer in Betrieb), Gruppe 2 mit Dienst 2 (seit September ausgefallen), Dienst 3 in Gruppe 1.
const groups = [{ id: 1, name: 'Gruppe A' }, { id: 2, name: 'Gruppe B' }]
const services = [
  { id: 1, name: 'Dienst A1', group: 1, startsAt: long, endsAt: null },
  { id: 3, name: 'Dienst A2', group: 1, startsAt: long, endsAt: null },
  { id: 2, name: 'Dienst B1', group: 2, startsAt: long, endsAt: null },
]
const events = [
  { service: 1, changedAt: long, status: 'operational', source: 'import' },
  { service: 3, changedAt: long, status: 'operational', source: 'import' },
  { service: 2, changedAt: long, status: 'major', source: 'import' },
  // erster Betriebseintrag am 20.10.: Störungen davor zählen in den Fußnoten
  { service: 1, changedAt: '2026-10-20T00:00:00.000Z', status: 'operational', source: 'operation' },
]
const early = '2026-10-05T00:00:00.000Z'
// Störung von Dienst 2 (Gruppe B) und eine ohne Dienst: Fußnoten dürfen sie für Gruppe A nicht zählen.
const incidents = [
  { title: 'B', updates: [{ message: 'x' }], createdAt: early, resolvedAt: null, affectedServices: [2] },
  { title: 'ohne Dienst', updates: [{ message: 'x' }], createdAt: early, resolvedAt: null, affectedServices: [] },
]

const fakePayload = (): Payload =>
  ({
    findGlobal: async () => ({}),
    find: async ({ collection }: { collection: string }) => {
      if (collection === 'service-groups') return { docs: groups }
      if (collection === 'services') return { docs: services }
      if (collection === 'service-status-events') return { docs: events }
      if (collection === 'incidents') return { docs: incidents }
      return { docs: [] }
    },
  }) as unknown as Payload

const search = { period: '2026-10' }

const build = async (scope?: 'all' | number[], extra: Record<string, string> = {}) => {
  const result = await loadReportContext(fakePayload(), { ...search, ...extra }, NOW, scope)
  assert.ok(result.ok)
  return result.context
}

test('Bereich [A]: nur Gruppe A und deren Dienste im Bericht', async () => {
  const context = await build([1])
  assert.deepEqual(context.groups.map((group) => group.name), ['Gruppe A'])
  const data = context.build().data
  assert.deepEqual(data.ranking.map((row) => row.name).sort(), ['Dienst A1', 'Dienst A2'])
  assert.deepEqual(data.groupList.map((entry) => entry.name), ['Gruppe A'])
})

test('Bereich [A]: Kennzahlen kommen nur aus Diensten der Gruppe, keine Summen fremder Gruppen', async () => {
  const scoped = (await build([1])).build().data
  const all = (await build('all')).build().data
  assert.equal(scoped.kpis.serviceCount, 2)
  assert.ok((scoped.kpis.availability ?? 0) > 99.9, 'Gruppe A war immer in Betrieb')
  assert.ok((all.kpis.availability ?? 100) < 80, 'mit Gruppe B zieht der Ausfall den Schnitt herunter')
  assert.equal(scoped.kpis.outageCount, 0)
})

test('Bereich [A]: Fußnoten zählen keine Störungen anderer Gruppen und keine ohne Dienst', async () => {
  const scoped = (await build([1])).build().data
  assert.deepEqual(scoped.footnotes, { unsure: 0, withoutService: 0 })
})

test('Bereich [A]: fremde Gruppe in der Adresse ist wie eine unbekannte Gruppe', async () => {
  const context = await build([1], { group: '2' })
  const data = context.build('2').data
  assert.ok(data.error, 'Fehler wie bei einer unbekannten Gruppe')
  assert.deepEqual(data.ranking, [])
  assert.deepEqual(data.groupList, [])
})

test('Bereich []: leerer Bericht ohne Gruppen', async () => {
  const context = await build([])
  assert.deepEqual(context.groups, [])
  assert.deepEqual(context.build().data.ranking, [])
  assert.equal(context.weakestGroupId(), null)
})

test('Bereich „alle“ und fehlender Bereich ergeben denselben Bericht wie bisher', async () => {
  const without = (await build(undefined)).build().data
  const all = (await build('all')).build().data
  assert.deepEqual(all, without)
  assert.deepEqual(all.groupList.map((entry) => entry.name).sort(), ['Gruppe A', 'Gruppe B'])
  assert.deepEqual(all.footnotes, { unsure: 1, withoutService: 1 })
})

test('loadReport reicht den Bereich weiter', async () => {
  const result = await loadReport(fakePayload(), search, NOW, [1])
  assert.ok(result.ok)
  assert.deepEqual(result.data.groupList.map((entry) => entry.name), ['Gruppe A'])
})
