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
const title = 'Nichtverfügbarkeit von Dienst A aufgrund von Wartungsarbeiten'
const rules = [{ field: 'title', match: 'contains', words: 'wartung', classification: 'maintenance' }] as const

test('ein gelöster Wartungsvorfall wird zu einer abgeschlossenen Wartung mit übernommenen Aktualisierungen', () => {
  const plan = planMaintenanceFromIncident({ ...base, title }, { rules })
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
  assert.deepEqual(planMaintenanceFromIncident({ ...base, title, resolvedAt: null }, { rules }), { skip: 'open' })
})

test('eine Einordnung von Hand verhindert die Umwandlung', () => {
  assert.deepEqual(planMaintenanceFromIncident({ ...base, title, availabilityClass: 'partial' }, { rules }), { skip: 'manual' })
})

test('ein Vorfall ohne Wartung im Titel wird übersprungen', () => {
  assert.deepEqual(planMaintenanceFromIncident({ ...base, title: 'Störung Dienst D - Analysephase' }, { rules }), { skip: 'not-maintenance' })
})

test('ein Vorfall ohne Kurz-ID bekommt eine Beschreibung ohne Kennung', () => {
  const plan = planMaintenanceFromIncident({ ...base, title, shortId: null }, { rules })
  assert.ok('maintenance' in plan)
  assert.equal(plan.maintenance.description, 'Übernommen aus einer Störung des Vorgängerverfahrens')
})

test('ein Vorfall nach dem Start des Statusprotokolls wird nicht umgewandelt', () => {
  const cutoffAt = '2026-11-10T15:56:00.000Z'
  assert.deepEqual(planMaintenanceFromIncident({ ...base, title, createdAt: '2026-11-11T08:00:00.000Z' }, { cutoffAt, rules }), { skip: 'after-start' })
  const before = planMaintenanceFromIncident({ ...base, title }, { cutoffAt, rules })
  assert.ok('maintenance' in before)
  const withoutCutoff = planMaintenanceFromIncident({ ...base, title, createdAt: '2026-11-11T08:00:00.000Z', resolvedAt: '2026-11-11T10:00:00.000Z' }, { rules })
  assert.ok('maintenance' in withoutCutoff)
})

test('ohne Regeln wird kein Vorfall umgewandelt, auch nicht mit „Wartung“ im Titel', () => {
  assert.deepEqual(planMaintenanceFromIncident({ ...base, title }), { skip: 'not-maintenance' })
  assert.deepEqual(planMaintenanceFromIncident({ ...base, title }, { rules: [] }), { skip: 'not-maintenance' })
})

test('eine Regel auf den Text der Aktualisierungen kann einen Vorfall als Wartung einordnen', () => {
  const byText = [{ field: 'updates', match: 'contains', words: 'wartungsarbeiten', classification: 'maintenance' }] as const
  assert.ok('maintenance' in planMaintenanceFromIncident({ ...base, title: 'Dienst A nicht verfügbar' }, { rules: byText }))
})

test('ein Vorfall mit Ende vor dem Beginn wird übersprungen', () => {
  const title = 'Wartung Dienst D'
  assert.deepEqual(
    planMaintenanceFromIncident({ ...base, title, createdAt: '2026-10-12T18:00:00.000Z', resolvedAt: '2026-10-12T17:00:00.000Z' }, { rules }),
    { skip: 'end-before-start' },
  )
  // Ende gleich Beginn ist gültig
  assert.ok('maintenance' in planMaintenanceFromIncident({ ...base, title, createdAt: '2026-10-12T18:00:00.000Z', resolvedAt: '2026-10-12T18:00:00.000Z' }, { rules }))
})
