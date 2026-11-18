import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canTransition, resolveScheduledStatus } from '@/lib/maintenance/schedule'

const NOW = new Date('2026-11-18T12:00:00Z')
const iso = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000).toISOString()
const base = { autoStartOnSchedule: true, autoCompleteOnSchedule: true }

test('vor dem Beginn bleibt der Status, ab dem Beginn läuft die Wartung', () => {
  assert.equal(resolveScheduledStatus({ ...base, status: 'upcoming', scheduledStartAt: iso(1) }, NOW), null)
  assert.equal(resolveScheduledStatus({ ...base, status: 'upcoming', scheduledStartAt: iso(0) }, NOW), 'in_progress')
  assert.equal(resolveScheduledStatus({ ...base, status: 'upcoming', scheduledStartAt: iso(-2), scheduledEndAt: iso(1) }, NOW), 'in_progress')
})

test('nach dem Ende ist die Wartung abgeschlossen, das Ende hat Vorrang vor dem Beginn', () => {
  assert.equal(resolveScheduledStatus({ ...base, status: 'in_progress', scheduledStartAt: iso(-3), scheduledEndAt: iso(-1) }, NOW), 'completed')
  assert.equal(resolveScheduledStatus({ ...base, status: 'upcoming', scheduledStartAt: iso(-3), scheduledEndAt: iso(-1) }, NOW), 'completed')
})

test('die Haken schalten den jeweiligen Übergang ab', () => {
  assert.equal(resolveScheduledStatus({ ...base, autoStartOnSchedule: false, status: 'upcoming', scheduledStartAt: iso(-1) }, NOW), null)
  assert.equal(resolveScheduledStatus({ ...base, autoCompleteOnSchedule: false, status: 'in_progress', scheduledStartAt: iso(-3), scheduledEndAt: iso(-1) }, NOW), null)
})

test('abgeschlossene und abgesagte Wartungen bleiben unverändert', () => {
  for (const status of ['completed', 'cancelled']) {
    assert.equal(resolveScheduledStatus({ ...base, status, scheduledStartAt: iso(-3), scheduledEndAt: iso(-1) }, NOW), null)
  }
  assert.equal(canTransition('completed', 'in_progress'), false)
  assert.equal(canTransition('in_progress', 'upcoming'), false)
})
