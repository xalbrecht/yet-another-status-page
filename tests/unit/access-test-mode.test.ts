import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allowRequest } from '@/lib/access'

const withTestMode = (value: string | undefined, run: () => void) => {
  const before = process.env.PAYLOAD_PUBLIC_ALLOW_WRITES
  if (value === undefined) delete process.env.PAYLOAD_PUBLIC_ALLOW_WRITES
  else process.env.PAYLOAD_PUBLIC_ALLOW_WRITES = value
  try {
    run()
  } finally {
    if (before === undefined) delete process.env.PAYLOAD_PUBLIC_ALLOW_WRITES
    else process.env.PAYLOAD_PUBLIC_ALLOW_WRITES = before
  }
}

test('Testmodus erlaubt anonyme Anfragen', () => {
  withTestMode('true', () => assert.equal(allowRequest(null), true))
})

test('Testmodus erlaubt angemeldeten Benutzern nichts zusätzlich', () => {
  withTestMode('true', () => assert.equal(allowRequest({ id: 1, roles: [] }), false))
})

test('Ohne Testmodus erlaubt allowRequest nichts', () => {
  withTestMode(undefined, () => assert.equal(allowRequest(null), false))
})
