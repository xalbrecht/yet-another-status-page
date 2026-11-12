import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planMaintenanceFromIncident } from '@/lib/maintenance-conversion'

const base = {
  id: 42,
  shortId: 'abc123',
  createdAt: '2026-10-12T18:00:00.000Z',
  resolvedAt: '2026-10-12T20:10:00.000Z',
  availabilityClass: 'auto',
  serviceIds: [7, 8],
  updates: [
    { status: 'investigating', message: 'Der Service ist wegen Wartungsarbeiten nicht verfügbar', createdAt: '2026-10-12T18:00:00.000Z' },
    { status: 'resolved', message: 'Die Wartung ist abgeschlossen', createdAt: '2026-10-12T20:10:00.000Z' },
  ],
}
const title = 'Nichtverfügbarkeit des Services TeVIS aufgrund von Wartungsarbeiten'

test('ein gelöster Wartungsvorfall wird zu einer abgeschlossenen Wartung mit übernommenen Aktualisierungen', () => {
  const plan = planMaintenanceFromIncident({ ...base, title })
  assert.ok('maintenance' in plan)
  assert.deepEqual(plan.maintenance, {
    title,
    description: 'Übernommen aus Störung abc123 (Vorgängerverfahren)',
    affectedServices: [7, 8],
    scheduledStartAt: '2026-10-12T18:00:00.000Z',
    scheduledEndAt: '2026-10-12T20:10:00.000Z',
    completedAt: '2026-10-12T20:10:00.000Z',
    status: 'completed',
    updates: [
      { status: 'in_progress', message: 'Der Service ist wegen Wartungsarbeiten nicht verfügbar', createdAt: '2026-10-12T18:00:00.000Z' },
      { status: 'completed', message: 'Die Wartung ist abgeschlossen', createdAt: '2026-10-12T20:10:00.000Z' },
    ],
  })
})

test('ein offener Vorfall wird übersprungen', () => {
  assert.deepEqual(planMaintenanceFromIncident({ ...base, title, resolvedAt: null }), { skip: 'open' })
})

test('eine Einordnung von Hand verhindert die Umwandlung', () => {
  assert.deepEqual(planMaintenanceFromIncident({ ...base, title, availabilityClass: 'partial' }), { skip: 'manual' })
})

test('ein Vorfall ohne Wartung im Titel wird übersprungen', () => {
  assert.deepEqual(planMaintenanceFromIncident({ ...base, title: 'Störung Autista - Analysephase' }), { skip: 'not-maintenance' })
})

test('ein Vorfall ohne Kurz-ID bekommt eine Beschreibung ohne Kennung', () => {
  const plan = planMaintenanceFromIncident({ ...base, title, shortId: null })
  assert.ok('maintenance' in plan)
  assert.equal(plan.maintenance.description, 'Übernommen aus einer Störung des Vorgängerverfahrens')
})

test('ein Vorfall nach dem Start des Statusprotokolls wird nicht umgewandelt', () => {
  const cutoffAt = '2026-11-10T15:56:00.000Z'
  assert.deepEqual(planMaintenanceFromIncident({ ...base, title, createdAt: '2026-11-11T08:00:00.000Z' }, { cutoffAt }), { skip: 'after-start' })
  const before = planMaintenanceFromIncident({ ...base, title }, { cutoffAt })
  assert.ok('maintenance' in before)
  const withoutCutoff = planMaintenanceFromIncident({ ...base, title, createdAt: '2026-11-11T08:00:00.000Z' })
  assert.ok('maintenance' in withoutCutoff)
})
