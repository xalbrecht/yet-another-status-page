import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import { dueMaintenanceWhere, processDueMaintenances, type DueDeps } from '@/lib/maintenance/process-due'

const NOW = Date.parse('2026-11-18T12:00:00Z')
const iso = (hours: number) => new Date(NOW + hours * 3_600_000).toISOString()

type Doc = Record<string, unknown>
const doc = (extra: Doc = {}): Doc => ({
  id: 1,
  title: 'Datenbank-Umzug',
  shortId: 'abc12345',
  status: 'upcoming',
  autoStartOnSchedule: true,
  autoCompleteOnSchedule: true,
  scheduledStartAt: iso(-1),
  scheduledEndAt: iso(2),
  duration: '3 Stunden',
  updates: [],
  ...extra,
})

/** Payload-Attrappe: nur die Aufrufe, die die Umstellung braucht. */
function setup(docs: Doc[], options: { failUpdateFor?: number; lockHeld?: boolean; failNotification?: boolean; failSend?: boolean } = {}) {
  const log: string[] = []
  const updates: Array<{ id: unknown; data: Record<string, unknown>; context: unknown }> = []
  const payload = {
    async find(args: { collection: string; where: unknown; context: unknown }) {
      log.push('find')
      assert.deepEqual(args.where, dueMaintenanceWhere(NOW))
      return { docs }
    },
    async findGlobal() {
      return { timezone: 'Europe/Berlin', locale: 'de-DE' }
    },
    async update(args: { id: number; data: Record<string, unknown>; context: unknown }) {
      if (args.id === options.failUpdateFor) throw new Error('Schreiben fehlgeschlagen')
      log.push(`update-${args.id}`)
      updates.push(args)
      return {}
    },
  } as unknown as Payload
  const notifications: Array<Record<string, unknown>> = []
  const sent: unknown[] = []
  const deps: DueDeps = {
    acquireLock: async () => {
      if (options.lockHeld) return null
      log.push('lock')
      return { release: async () => void log.push('unlock') }
    },
    createNotification: async (_payload, data) => {
      if (options.failNotification) throw new Error('kein Entwurf')
      notifications.push(data as unknown as Record<string, unknown>)
      return { id: 900 + notifications.length }
    },
    sendDraft: async (_payload, id) => {
      if (options.failSend) throw new Error('Versand fehlgeschlagen')
      sent.push(id)
    },
  }
  return { payload, deps, log, updates, notifications, sent }
}

test('Beginn erreicht: Status „läuft“, ein Eintrag im Verlauf, Entwurf und sofortiger Versand', async () => {
  const t = setup([doc()])
  const result = await processDueMaintenances(t.payload, NOW, t.deps)
  assert.deepEqual(result, { skipped: null, transitioned: [{ id: 1, status: 'in_progress' }], notificationFailed: [] })
  assert.equal(t.updates.length, 1)
  const data = t.updates[0].data as { status: string; updates: Array<{ status: string; message: string; createdAt: string }> }
  assert.equal(data.status, 'in_progress')
  assert.equal(data.updates.length, 1)
  assert.deepEqual(data.updates[0], { status: 'in_progress', message: 'Die Wartung hat begonnen.', createdAt: new Date(NOW).toISOString() })
  assert.deepEqual(t.updates[0].context, { skipScheduleOverlay: true, skipNotificationCreation: true })
  assert.equal(t.notifications.length, 1)
  assert.deepEqual(t.sent, [901])
  assert.deepEqual(t.notifications[0], {
    docId: 1, title: 'Datenbank-Umzug', shortId: 'abc12345', statusLabel: 'In Arbeit', isUpdate: true, updateIndex: 0,
    startTimeStr: t.notifications[0].startTimeStr, endTimeStr: t.notifications[0].endTimeStr, duration: '3 Stunden',
    message: 'Die Wartung hat begonnen.',
  })
})

test('Ende erreicht: Status „abgeschlossen“, der Eintrag kommt hinter die vorhandenen', async () => {
  const earlier = { status: 'in_progress', message: 'Los geht es.', createdAt: iso(-3) }
  const t = setup([doc({ status: 'in_progress', scheduledEndAt: iso(-0.5), updates: [earlier] })])
  const result = await processDueMaintenances(t.payload, NOW, t.deps)
  assert.deepEqual(result.transitioned, [{ id: 1, status: 'completed' }])
  const data = t.updates[0].data as { updates: Array<Record<string, unknown>> }
  assert.equal(data.updates.length, 2)
  assert.deepEqual(data.updates[0], earlier)
  assert.equal(data.updates[1].message, 'Die Wartung ist abgeschlossen.')
  assert.equal(t.notifications[0].updateIndex, 1)
  assert.equal(t.notifications[0].statusLabel, 'Abgeschlossen')
})

test('ohne gültigen Übergang geschieht nichts: Haken aus, vor dem Beginn, Status schon erreicht', async () => {
  const t = setup([
    doc({ id: 1, autoStartOnSchedule: false }),
    doc({ id: 2, scheduledStartAt: iso(1) }),
    doc({ id: 3, status: 'in_progress', scheduledEndAt: iso(1) }),
  ])
  const result = await processDueMaintenances(t.payload, NOW, t.deps)
  assert.deepEqual(result.transitioned, [])
  assert.equal(t.updates.length, 0)
  assert.equal(t.notifications.length, 0)
})

test('hält ein anderer Prozess die Sperre, wird nichts gelesen und nichts versandt', async () => {
  const t = setup([doc()], { lockHeld: true })
  const result = await processDueMaintenances(t.payload, NOW, t.deps)
  assert.deepEqual(result, { skipped: 'locked', transitioned: [], notificationFailed: [] })
  assert.deepEqual(t.log, [])
})

test('die Sperre gilt für den ganzen Lauf und wird danach freigegeben', async () => {
  const t = setup([doc()])
  await processDueMaintenances(t.payload, NOW, t.deps)
  assert.deepEqual(t.log, ['lock', 'find', 'update-1', 'unlock'])
})

test('scheitert das Speichern einer Wartung, laufen die anderen weiter und es geht keine Meldung zu ihr hinaus', async () => {
  const t = setup([doc({ id: 1 }), doc({ id: 2 })], { failUpdateFor: 1 })
  const result = await processDueMaintenances(t.payload, NOW, t.deps)
  assert.deepEqual(result.transitioned, [{ id: 2, status: 'in_progress' }])
  assert.equal(t.notifications.length, 1)
  assert.equal(t.notifications[0].docId, 2)
})

test('scheitert Entwurf oder Versand, bleibt die Umstellung gespeichert und die Wartung steht in der Fehlerliste', async () => {
  for (const options of [{ failNotification: true }, { failSend: true }]) {
    const t = setup([doc()], options)
    const result = await processDueMaintenances(t.payload, NOW, t.deps)
    assert.deepEqual(result.transitioned, [{ id: 1, status: 'in_progress' }])
    assert.deepEqual(result.notificationFailed, [1])
    assert.deepEqual(t.log.at(-1), 'unlock')
  }
})

test('die Abfrage nimmt nur offene Wartungen, deren Beginn oder Ende erreicht ist, jeweils bei gesetztem Haken', () => {
  assert.deepEqual(dueMaintenanceWhere(NOW), {
    and: [
      { status: { in: ['upcoming', 'in_progress'] } },
      {
        or: [
          { and: [{ autoStartOnSchedule: { equals: true } }, { scheduledStartAt: { less_than_equal: new Date(NOW).toISOString() } }] },
          { and: [{ autoCompleteOnSchedule: { equals: true } }, { scheduledEndAt: { less_than_equal: new Date(NOW).toISOString() } }] },
        ],
      },
    ],
  })
})
