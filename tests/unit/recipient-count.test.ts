import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload, PayloadRequest } from 'payload'
import { estimateRecipients } from '@/lib/recipient-count'

// Der Hook `afterRead` der Benachrichtigungen schätzt die Empfängerzahl je Entwurf. Eine Liste mit mehreren Entwürfen
// darf nicht je Entwurf neu zählen (Issue #276).

type Where = Record<string, unknown>

function fakePayload(groupOfIncident: (id: string) => number) {
  const calls = { findByID: 0, find: 0, count: 0 }
  const payload = {
    async findByID({ id }: { id: string }) {
      calls.findByID++
      return { id, affectedServices: [Number(id)] }
    },
    async find({ where }: { where: { id: { in: string[] } } }) {
      calls.find++
      return { docs: where.id.in.map((id) => ({ id, group: groupOfIncident(String(id)) })) }
    },
    async count({ where }: { where: Where }) {
      calls.count++
      // Die Zahl hängt von der Gruppenwahl ab, damit ein falsch geteilter Zwischenspeicher auffällt
      const text = JSON.stringify(where)
      return { totalDocs: text.includes('"in":[7]') ? 7 : text.includes('"in":[8]') ? 8 : 1 }
    },
  }
  return { payload: payload as unknown as Payload, calls }
}

const request = (payload: Payload) => ({ payload, context: {} }) as unknown as PayloadRequest

test('Entwürfe mit derselben Gruppenwahl werden nur einmal gezählt', async () => {
  const { payload, calls } = fakePayload(() => 7)
  const req = request(payload)
  const counts: number[] = []
  for (const incident of [1, 2, 3, 4, 5]) {
    counts.push(await estimateRecipients(payload, { channel: 'both', relatedIncident: incident }, req))
  }
  assert.deepEqual(counts, [14, 14, 14, 14, 14], 'E-Mail und SMS je 7')
  assert.equal(calls.count, 2, 'eine Zählung je Kanal, unabhängig von der Zahl der Entwürfe')
})

test('Entwürfe mit anderer Gruppenwahl behalten ihre eigene Zahl', async () => {
  const { payload } = fakePayload((id) => (id === '1' ? 7 : 8))
  const req = request(payload)
  assert.equal(await estimateRecipients(payload, { channel: 'email', relatedIncident: 1 }, req), 7)
  assert.equal(await estimateRecipients(payload, { channel: 'email', relatedIncident: 2 }, req), 8)
  assert.equal(await estimateRecipients(payload, { channel: 'email', relatedIncident: 1 }, req), 7)
})

test('dieselbe Störung wird je Anfrage nur einmal gelesen', async () => {
  const { payload, calls } = fakePayload(() => 7)
  const req = request(payload)
  await estimateRecipients(payload, { channel: 'email', relatedIncident: 1 }, req)
  await estimateRecipients(payload, { channel: 'sms', relatedIncident: 1 }, req)
  assert.equal(calls.findByID, 1)
  assert.equal(calls.find, 1)
})

test('eine neue Anfrage zählt neu', async () => {
  const { payload, calls } = fakePayload(() => 7)
  await estimateRecipients(payload, { channel: 'email', relatedIncident: 1 }, request(payload))
  await estimateRecipients(payload, { channel: 'email', relatedIncident: 1 }, request(payload))
  assert.equal(calls.count, 2)
})
