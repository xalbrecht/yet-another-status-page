import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_DATETIME_CONFIG, formatDateTime } from '@/lib/datetime'
import { t, tf } from '@/lib/i18n'
import {
  buildIncidentItems,
  buildMaintenanceItems,
  limitBoxItems,
  parseBoxContent,
  parseBoxEntries,
  parseBoxesPlacement,
} from '@/lib/status-boxes'

const dt = DEFAULT_DATETIME_CONFIG
const at = (iso: string) => formatDateTime(new Date(iso), dt)

test('parseBoxEntries begrenzt auf ganze Zahlen von 1 bis 10 und fällt sonst auf 3 zurück', () => {
  assert.equal(parseBoxEntries('3'), 3)
  assert.equal(parseBoxEntries(0), 3)
  assert.equal(parseBoxEntries(11), 10)
  assert.equal(parseBoxEntries(-2), 1)
  assert.equal(parseBoxEntries('abc'), 3)
  assert.equal(parseBoxEntries(undefined), 3)
  assert.equal(parseBoxEntries(4.7), 4)
})

test('parseBoxContent und parseBoxesPlacement nehmen nur die erlaubten Werte', () => {
  assert.equal(parseBoxContent('x'), 'full')
  assert.equal(parseBoxContent('compact'), 'compact')
  assert.equal(parseBoxesPlacement('after'), 'after')
  assert.equal(parseBoxesPlacement(null), 'before')
})

test('limitBoxItems schneidet ab und zählt den Rest', () => {
  assert.deepEqual(limitBoxItems([1, 2, 3, 4], 3), { shown: [1, 2, 3], more: 1 })
  assert.deepEqual(limitBoxItems([1, 2, 3], 3), { shown: [1, 2, 3], more: 0 })
  assert.deepEqual(limitBoxItems([], 3), { shown: [], more: 0 })
})

test('buildIncidentItems lässt gelöste Störungen weg', () => {
  const items = buildIncidentItems(
    [
      {
        id: 1,
        shortId: 'aaa',
        title: 'Gelöst',
        impact: 'major',
        createdAt: '2026-11-13T08:00:00.000Z',
        updates: [
          { status: 'investigating', message: 'Start', createdAt: '2026-11-13T08:00:00.000Z' },
          { status: 'resolved', message: 'Fertig', createdAt: '2026-11-13T09:00:00.000Z' },
        ],
        affectedServices: [],
      },
    ],
    dt,
  )
  assert.deepEqual(items, [])
})

test('buildIncidentItems bildet eine offene Störung auf einen Boxeintrag ab', () => {
  const [item] = buildIncidentItems(
    [
      {
        id: 7,
        shortId: 'abc123',
        title: 'Mail-Zustellung gestört',
        impact: 'partial',
        createdAt: '2026-11-13T08:00:00.000Z',
        updates: [
          { status: 'investigating', message: 'Wir prüfen es', createdAt: '2026-11-13T08:00:00.000Z' },
          { status: 'identified', message: 'Ursache gefunden', createdAt: '2026-11-13T08:30:00.000Z' },
        ],
        affectedServices: [{ id: 1, name: 'Mail' }, { id: 2, name: 'Webmail' }, 3],
      },
    ],
    dt,
  )
  assert.equal(item.id, '7')
  assert.equal(item.href, '/i/abc123')
  assert.equal(item.title, 'Mail-Zustellung gestört')
  assert.equal(item.status, 'partial')
  assert.equal(item.stateLabel, t('incident.identified'))
  assert.equal(item.when, at('2026-11-13T08:00:00.000Z'))
  assert.deepEqual(item.services, ['Mail', 'Webmail'])
  assert.equal(item.last, 'Ursache gefunden')
})

test('buildIncidentItems behandelt Störungen ohne Updates und ohne Dienste', () => {
  const [item] = buildIncidentItems(
    [{ id: 8, shortId: 'xyz', title: 'Neu', impact: 'degraded', createdAt: '2026-11-13T10:00:00.000Z' }],
    dt,
  )
  assert.equal(item.last, null)
  assert.deepEqual(item.services, [])
  assert.equal(item.stateLabel, t('incident.investigating'))
  assert.ok(!item.stateLabel.includes('undefined'))
})

test('buildIncidentItems behält die Reihenfolge der Eingabe', () => {
  const make = (id: number) => ({
    id,
    shortId: `s${id}`,
    title: `T${id}`,
    impact: 'degraded' as const,
    createdAt: '2026-11-13T10:00:00.000Z',
    updates: [],
  })
  assert.deepEqual(
    buildIncidentItems([make(3), make(1), make(2)], dt).map((i) => i.id),
    ['3', '1', '2'],
  )
})

const maintenance = (over: Record<string, unknown>) => ({
  id: 1,
  shortId: 'm1',
  title: 'Wartung',
  status: 'upcoming' as const,
  scheduledStartAt: '2026-11-20T20:00:00.000Z',
  scheduledEndAt: '2026-11-20T22:00:00.000Z',
  affectedServices: [],
  updates: [],
  ...over,
})

test('buildMaintenanceItems zeigt nur geplante und laufende Wartungen', () => {
  const items = buildMaintenanceItems(
    [
      maintenance({ id: 1, status: 'completed' }),
      maintenance({ id: 2, status: 'cancelled' }),
      maintenance({ id: 3, status: 'upcoming' }),
      maintenance({ id: 4, status: 'in_progress' }),
    ],
    dt,
  )
  assert.deepEqual(items.map((i) => i.id), ['3', '4'])
})

test('buildMaintenanceItems setzt Link, Status und Zeitraum', () => {
  const [item] = buildMaintenanceItems([maintenance({ affectedServices: [{ id: 5, name: 'Portal' }] })], dt)
  assert.equal(item.href, '/m/m1')
  assert.equal(item.status, 'maintenance')
  assert.equal(item.stateLabel, t('maintenance.upcoming'))
  assert.equal(
    item.when,
    tf('maintenance.noticeSoon', {
      start: at('2026-11-20T20:00:00.000Z'),
      end: at('2026-11-20T22:00:00.000Z'),
    }),
  )
  assert.deepEqual(item.services, ['Portal'])
})

test('buildMaintenanceItems nennt ohne Ende nur den Beginn', () => {
  const [item] = buildMaintenanceItems([maintenance({ scheduledEndAt: null })], dt)
  assert.equal(item.when, tf('maintenance.noticeSoonOpen', { start: at('2026-11-20T20:00:00.000Z') }))
})

test('buildMaintenanceItems sortiert nach Beginn aufsteigend', () => {
  const items = buildMaintenanceItems(
    [
      maintenance({ id: 1, scheduledStartAt: '2026-11-22T20:00:00.000Z' }),
      maintenance({ id: 2, scheduledStartAt: '2026-11-20T20:00:00.000Z' }),
      maintenance({ id: 3, scheduledStartAt: '2026-11-21T20:00:00.000Z' }),
    ],
    dt,
  )
  assert.deepEqual(items.map((i) => i.id), ['2', '3', '1'])
})
