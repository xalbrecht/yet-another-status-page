import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import { requireRoles } from '@/lib/route-auth'

const payloadFor = (user: unknown) => ({ auth: async () => ({ user }) }) as unknown as Payload
const headers = new Headers()

const withTestMode = async (value: string | undefined, run: () => Promise<void>) => {
  const before = process.env.PAYLOAD_PUBLIC_ALLOW_WRITES
  if (value === undefined) delete process.env.PAYLOAD_PUBLIC_ALLOW_WRITES
  else process.env.PAYLOAD_PUBLIC_ALLOW_WRITES = value
  try {
    await run()
  } finally {
    if (before === undefined) delete process.env.PAYLOAD_PUBLIC_ALLOW_WRITES
    else process.env.PAYLOAD_PUBLIC_ALLOW_WRITES = before
  }
}

test('ohne Anmeldung: 401', async () => {
  await withTestMode(undefined, async () => {
    const result = await requireRoles(payloadFor(null), headers, ['admin'])
    assert.deepEqual(result.ok ? null : result.status, 401)
  })
})

test('angemeldet ohne Rolle oder mit leerer Liste: 403', async () => {
  await withTestMode(undefined, async () => {
    for (const user of [{ id: 1 }, { id: 1, roles: [] }, { id: 1, roles: null }]) {
      const result = await requireRoles(payloadFor(user), headers, ['admin', 'servicedesk'])
      assert.equal(result.ok ? null : result.status, 403)
    }
  })
})

test('angemeldet mit fremder Rolle: 403', async () => {
  await withTestMode(undefined, async () => {
    const result = await requireRoles(payloadFor({ id: 1, roles: ['produktmanager'] }), headers, ['admin', 'servicedesk'])
    assert.equal(result.ok ? null : result.status, 403)
  })
})

test('angemeldet mit passender Rolle: ok mit Benutzer', async () => {
  await withTestMode(undefined, async () => {
    const user = { id: 7, roles: ['servicedesk'] }
    const result = await requireRoles(payloadFor(user), headers, ['admin', 'servicedesk'])
    assert.ok(result.ok)
    assert.equal(result.ok && (result.user as { id: number }).id, 7)
  })
})

test('Testmodus: anonym ok ohne Benutzer, angemeldet mit fremder Rolle weiter 403', async () => {
  await withTestMode('true', async () => {
    const anonymous = await requireRoles(payloadFor(null), headers, ['admin'])
    assert.ok(anonymous.ok)
    assert.equal(anonymous.ok && anonymous.user, null)
    const wrong = await requireRoles(payloadFor({ id: 1, roles: ['servicedesk'] }), headers, ['admin'])
    assert.equal(wrong.ok ? null : wrong.status, 403)
  })
})

test('die Fehlermeldung ist ein Text', async () => {
  await withTestMode(undefined, async () => {
    const result = await requireRoles(payloadFor({ id: 1, roles: [] }), headers, ['admin'])
    assert.ok(!result.ok && typeof result.message === 'string' && result.message.length > 0)
  })
})
