import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import type { Access } from 'payload'
import { MessageTemplates } from '@/collections/MessageTemplates'

const original = process.env.PAYLOAD_PUBLIC_ALLOW_WRITES
afterEach(() => {
  if (original === undefined) delete process.env.PAYLOAD_PUBLIC_ALLOW_WRITES
  else process.env.PAYLOAD_PUBLIC_ALLOW_WRITES = original
})

const ask = (access: Access | undefined, user: unknown) => (access as (args: unknown) => unknown)({ req: { user } })
const operations = ['read', 'create', 'update', 'delete'] as const

test('Vorlagen sind ohne Anmeldung weder les- noch schreibbar', () => {
  delete process.env.PAYLOAD_PUBLIC_ALLOW_WRITES
  for (const operation of operations) assert.equal(ask(MessageTemplates.access?.[operation], null), false, operation)
})

test('ServiceDesk und Admin dürfen lesen und schreiben, ohne Rolle und Produktmanager nicht', () => {
  delete process.env.PAYLOAD_PUBLIC_ALLOW_WRITES
  for (const operation of operations) {
    assert.equal(ask(MessageTemplates.access?.[operation], { id: 1, roles: ['servicedesk'] }), true, operation)
    assert.equal(ask(MessageTemplates.access?.[operation], { id: 1, roles: ['admin'] }), true, operation)
    assert.equal(ask(MessageTemplates.access?.[operation], { id: 1, roles: ['produktmanager'] }), false, operation)
    assert.equal(ask(MessageTemplates.access?.[operation], { id: 1 }), false, operation)
  }
})

test('nur im Testmodus der Testumgebung ist der Zugriff offen', () => {
  process.env.PAYLOAD_PUBLIC_ALLOW_WRITES = 'true'
  for (const operation of operations) assert.equal(ask(MessageTemplates.access?.[operation], null), true, operation)
})

test('die Auswirkung entfällt bei einer Wartung, bei einer Störung bleibt sie', async () => {
  const hook = MessageTemplates.hooks?.beforeChange?.[0] as (args: { data: Record<string, unknown> }) => { impact?: unknown }
  assert.equal(hook({ data: { kind: 'maintenance', impact: 'major' } }).impact, null)
  assert.equal(hook({ data: { kind: 'incident', impact: 'major' } }).impact, 'major')
})
