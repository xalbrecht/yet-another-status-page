import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import { groupIdsOfServices } from '@/lib/access'
import { scopeAllows, type RoleUser } from '@/lib/roles'

// Dienste 1 und 2 in Gruppe 10, Dienst 3 in Gruppe 20, Dienst 4 ohne Gruppe, Dienst 5 gibt es nicht.
const services: Record<string, { id: number; group: number | { id: number } | null }> = {
  '1': { id: 1, group: 10 },
  '2': { id: 2, group: { id: 10 } },
  '3': { id: 3, group: 20 },
  '4': { id: 4, group: null },
}
const payload = {
  find: async ({ where }: { where: { id: { in: string[] } } }) => ({
    docs: where.id.in.map((id) => services[id]).filter(Boolean),
  }),
} as unknown as Payload

const desk = (groups: number[]): RoleUser => ({ roles: ['servicedesk'], servicedeskGruppen: groups })

test('groupIdsOfServices nennt die Gruppen der Dienste ohne Doppelte', async () => {
  assert.deepEqual(await groupIdsOfServices(payload, ['1', '2', '3']), [10, 20])
})

test('groupIdsOfServices liefert eine leere Liste ohne Dienste', async () => {
  assert.deepEqual(await groupIdsOfServices(payload, []), [])
})

test('groupIdsOfServices liefert null, wenn ein Dienst keine Gruppe hat oder fehlt', async () => {
  assert.equal(await groupIdsOfServices(payload, ['1', '4']), null)
  assert.equal(await groupIdsOfServices(payload, ['1', '5']), null)
})

test('Wartung mit Diensten aus Gruppe 10 und 20, Bereich nur 10: Lesen ja, Schreiben nein', async () => {
  const groups = (await groupIdsOfServices(payload, ['1', '3'])) ?? []
  assert.equal(scopeAllows(desk([10]), ['servicedesk'], groups, 'any'), true)
  assert.equal(scopeAllows(desk([10]), ['servicedesk'], groups, 'all'), false)
})

test('Dienst ohne Gruppe: nur Admin darf (null wird als verweigert behandelt)', async () => {
  const groups = await groupIdsOfServices(payload, ['4'])
  assert.equal(groups, null)
  assert.equal(scopeAllows(desk([10]), ['servicedesk'], groups ?? [], 'all'), false)
  assert.equal(scopeAllows({ roles: ['admin'] }, ['servicedesk'], groups ?? [], 'all'), true)
})
