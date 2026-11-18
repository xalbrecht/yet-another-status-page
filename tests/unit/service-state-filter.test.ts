import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Where } from 'payload'
import { applyServiceState, detectServiceState, serviceStateConditions } from '@/lib/service-lifecycle'

const AT = Date.parse('2026-11-18T10:00:00Z')
const ISO = new Date(AT).toISOString()
const nameFilter: Where = { and: [{ or: [{ name: { like: 'Mail' } }] }] }

test('jeder Zustand ergibt Bedingungen im Format des Filters von Payload (and aus or)', () => {
  assert.deepEqual(serviceStateConditions('ended', AT), [{ or: [{ endsAt: { less_than: ISO } }] }])
  assert.deepEqual(serviceStateConditions('not-started', AT), [{ or: [{ startsAt: { greater_than: ISO } }] }])
  assert.deepEqual(serviceStateConditions('active', AT), [
    { or: [{ startsAt: { less_than_equal: ISO } }] },
    { or: [{ endsAt: { exists: false } }, { endsAt: { greater_than_equal: ISO } }] },
  ])
})

test('ohne Filter ist kein Zustand gewählt, nach dem Setzen wird er wiedererkannt', () => {
  assert.equal(detectServiceState(undefined), null)
  assert.equal(detectServiceState({}), null)
  assert.equal(detectServiceState(nameFilter), null)
  for (const state of ['active', 'ended', 'not-started'] as const) {
    assert.equal(detectServiceState(applyServiceState(undefined, state, AT)), state)
  }
})

test('der Zustand wird auch erkannt, wenn die Werte als Text aus der Adresszeile kommen', () => {
  const fromUrl = { and: [{ or: [{ startsAt: { less_than_equal: ISO } }] }, { or: [{ endsAt: { exists: 'false' } }, { endsAt: { greater_than_equal: ISO } }] }] } as unknown as Where
  assert.equal(detectServiceState(fromUrl), 'active')
})

test('andere Bedingungen bleiben erhalten, ein vorhandener Zustand wird ersetzt', () => {
  const ended = applyServiceState(nameFilter, 'ended', AT)
  assert.deepEqual(ended, { and: [{ or: [{ name: { like: 'Mail' } }] }, { or: [{ endsAt: { less_than: ISO } }] }] })
  const switched = applyServiceState(ended, 'active', AT + 1000)
  assert.equal(detectServiceState(switched), 'active')
  assert.deepEqual((switched as { and: unknown[] }).and[0], { or: [{ name: { like: 'Mail' } }] })
  assert.equal((switched as { and: unknown[] }).and.length, 3, 'Namensfilter plus zwei Bedingungen für aktiv')
})

test('„Alle“ entfernt nur den Zustand: ohne weitere Bedingungen bleibt keine Abfrage, sonst der Rest', () => {
  assert.equal(applyServiceState(applyServiceState(undefined, 'ended', AT), null, AT), undefined)
  assert.deepEqual(applyServiceState(applyServiceState(nameFilter, 'ended', AT), null, AT), nameFilter)
})

test('ein Filter auf oberster Ebene (ohne and) geht nicht verloren', () => {
  const flat = { name: { like: 'Mail' } } as Where
  assert.deepEqual(applyServiceState(flat, 'not-started', AT), { and: [{ name: { like: 'Mail' } }, { or: [{ startsAt: { greater_than: ISO } }] }] })
})

test('Filter auf andere Felder oder Operatoren gelten nicht als Zustand', () => {
  assert.equal(detectServiceState({ and: [{ or: [{ endsAt: { equals: ISO } }] }] }), null)
  assert.equal(detectServiceState({ and: [{ or: [{ status: { equals: 'major' } }] }] }), null)
})
