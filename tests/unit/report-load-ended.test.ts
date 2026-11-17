import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import { loadReportContext } from '@/lib/report/load'

const NOW = Date.parse('2026-11-17T10:00:00Z')
const DAY = 24 * 3600_000

const service = (id: number, name: string, startsAt: number, endsAt: number | null) => ({
  id,
  name,
  group: 1,
  startsAt: new Date(startsAt).toISOString(),
  endsAt: endsAt === null ? null : new Date(endsAt).toISOString(),
})

const docs = [
  service(1, 'aktiv', NOW - 300 * DAY, null),
  service(2, 'endet bald', NOW - 300 * DAY, NOW + 10 * DAY),
  service(3, 'beendet', NOW - 300 * DAY, NOW - 5 * DAY),
  service(4, 'noch nicht begonnen', NOW + 20 * DAY, null),
]

function fakePayload(): Payload {
  return {
    findGlobal: async () => ({}),
    find: async ({ collection }: { collection: string }) => {
      if (collection === 'service-groups') return { docs: [{ id: 1, name: 'Gruppe' }] }
      if (collection === 'services') return { docs }
      return { docs: [] }
    },
  } as unknown as Payload
}

const names = async (search: Record<string, string>) => {
  const result = await loadReportContext(fakePayload(), { period: '2026-10', ...search }, NOW)
  assert.ok(result.ok)
  return result.context.build().data.ranking.map((row) => row.name).sort()
}

test('ohne Schalter zeigt der Bericht nur Dienste, die am Berichtsdatum aktiv sind', async () => {
  assert.deepEqual(await names({}), ['aktiv', 'endet bald'])
})

test('mit Schalter kommen beendete Dienste dazu, Dienste mit Beginn in der Zukunft nie', async () => {
  assert.deepEqual(await names({ ended: 'true' }), ['aktiv', 'beendet', 'endet bald'])
})

test('beendete Dienste tragen ihr Ende und sind heute nicht aktiv', async () => {
  const result = await loadReportContext(fakePayload(), { period: '2026-10', ended: 'true' }, NOW)
  assert.ok(result.ok)
  const row = result.context.build().data.ranking.find((entry) => entry.name === 'beendet')
  assert.equal(row?.activeToday, false)
  assert.equal(row?.endedAt, NOW - 5 * DAY)
})
