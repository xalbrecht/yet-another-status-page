import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canDeleteService } from '@/lib/service-lifecycle'

const NOW = Date.UTC(2026, 10, 17, 12, 0, 0)
const START = Date.UTC(2025, 0, 1)

test('ohne Ende lässt sich ein Dienst nicht löschen (aktiv)', () => {
  assert.deepEqual(canDeleteService({ startsAt: START }, NOW), { ok: false, reason: 'active' })
  assert.deepEqual(canDeleteService({ startsAt: START, endsAt: null }, NOW), { ok: false, reason: 'active' })
})

test('mit Ende in der Zukunft lässt sich ein Dienst nicht löschen', () => {
  const endsAt = Date.UTC(2026, 10, 18, 23, 59, 59, 999)
  assert.deepEqual(canDeleteService({ startsAt: START, endsAt }, NOW), { ok: false, reason: 'ends-in-future' })
})

test('am Endtag selbst ist der Dienst noch aktiv und lässt sich nicht löschen', () => {
  const endsAt = Date.UTC(2026, 10, 17, 23, 59, 59, 999)
  assert.deepEqual(canDeleteService({ startsAt: START, endsAt }, NOW), { ok: false, reason: 'ends-in-future' })
})

test('mit Ende in der Vergangenheit lässt sich ein Dienst löschen', () => {
  const endsAt = Date.UTC(2026, 10, 16, 23, 59, 59, 999)
  assert.deepEqual(canDeleteService({ startsAt: START, endsAt }, NOW), { ok: true })
})
