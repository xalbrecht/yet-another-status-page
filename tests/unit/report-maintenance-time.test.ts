import { test } from 'node:test'
import assert from 'node:assert/strict'
import { maintenanceWindow, type MaintenanceInput } from '@/lib/report/maintenance-time'

const iso = (value: string) => new Date(value).toISOString()
const NOW = Date.parse('2026-10-13T12:00:00Z')

const base: MaintenanceInput = {
  status: 'completed',
  scheduledStartAt: iso('2026-10-12T20:00:00Z'),
  scheduledEndAt: iso('2026-10-12T22:00:00Z'),
  completedAt: null,
  cancelledAt: null,
  updates: [],
  serviceIds: [1],
}
const minutes = (window: { from: number; to: number } | null) => (window ? (window.to - window.from) / 60_000 : null)

test('abgeschlossen mit Aktualisierungen „Läuft“ und „Abgeschlossen“: tatsächliche Zeit, 185 Minuten', () => {
  const window = maintenanceWindow(
    {
      ...base,
      completedAt: iso('2026-10-12T23:15:00Z'),
      updates: [
        { status: 'in_progress', createdAt: iso('2026-10-12T20:10:00Z') },
        { status: 'completed', createdAt: iso('2026-10-12T23:15:00Z') },
      ],
    },
    NOW,
  )
  assert.deepEqual(window, { from: Date.parse('2026-10-12T20:10:00Z'), to: Date.parse('2026-10-12T23:15:00Z') })
  assert.equal(minutes(window), 185)
})

test('abgeschlossen ohne Aktualisierungen, nur automatisch umgestellt: geplante Zeit', () => {
  assert.equal(minutes(maintenanceWindow(base, NOW)), 120)
})

test('abgeschlossen mit Aktualisierung „Abgeschlossen“ ohne „Läuft“: geplanter Beginn, tatsächliches Ende', () => {
  const window = maintenanceWindow(
    { ...base, completedAt: iso('2026-10-12T22:40:00Z'), updates: [{ status: 'completed', createdAt: iso('2026-10-12T22:40:00Z') }] },
    NOW,
  )
  assert.equal(minutes(window), 160)
})

test('„Abgeschlossen am“ allein zählt nicht: bei automatischer Umstellung steht dort die Zeit des Lesens, nicht des Endes', () => {
  assert.equal(minutes(maintenanceWindow({ ...base, completedAt: iso('2026-10-13T09:00:00Z') }, NOW)), 120)
})

test('laufende Wartung endet jetzt', () => {
  const window = maintenanceWindow({ ...base, status: 'in_progress', scheduledEndAt: null }, Date.parse('2026-10-12T21:00:00Z'))
  assert.deepEqual(window, { from: Date.parse('2026-10-12T20:00:00Z'), to: Date.parse('2026-10-12T21:00:00Z') })
})

test('abgebrochen nach dem Start: bis zum Abbruch', () => {
  const window = maintenanceWindow(
    {
      ...base,
      status: 'cancelled',
      cancelledAt: iso('2026-10-12T20:45:00Z'),
      updates: [{ status: 'in_progress', createdAt: iso('2026-10-12T20:10:00Z') }],
    },
    NOW,
  )
  assert.equal(minutes(window), 35)
})

test('abgebrochen vor dem Start und ohne „Läuft“: keine Wartungszeit', () => {
  assert.equal(
    maintenanceWindow({ ...base, status: 'cancelled', cancelledAt: iso('2026-10-12T18:00:00Z') }, NOW),
    null,
  )
})

test('abgebrochen ohne „Läuft“, aber nach dem geplanten Beginn: gilt als gestartet', () => {
  const window = maintenanceWindow({ ...base, status: 'cancelled', cancelledAt: iso('2026-10-12T20:30:00Z') }, NOW)
  assert.equal(minutes(window), 30)
})

test('geplant: keine Wartungszeit', () => {
  assert.equal(maintenanceWindow({ ...base, status: 'upcoming' }, NOW), null)
})

test('Ende vor oder gleich Beginn: keine Wartungszeit', () => {
  assert.equal(maintenanceWindow({ ...base, scheduledEndAt: iso('2026-10-12T20:00:00Z') }, NOW), null)
  assert.equal(maintenanceWindow({ ...base, scheduledEndAt: iso('2026-10-12T19:00:00Z') }, NOW), null)
})
