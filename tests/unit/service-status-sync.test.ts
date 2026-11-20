import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import { decideServiceState, syncServiceStatusesFromIncidents } from '@/lib/service-status-sync'

// Issue #210: Der Dienst merkt sich den Zustand vor dem ersten Vorfall und kehrt beim Ende des letzten offenen Vorfalls
// auf Wunsch dorthin zurück.

const base = {
  current: 'operational' as const,
  remembered: null,
  worstOpenImpact: undefined,
  otherOpenIncidentsCoverService: false,
  wasCoveredBefore: false,
  restore: false,
}

test('merkt „eingeschränkt“ beim ersten Vorfall', () => {
  assert.deepEqual(decideServiceState({ ...base, current: 'degraded', worstOpenImpact: 'partial' }), {
    target: 'partial',
    remember: 'degraded',
  })
})

test('merkt „betriebsbereit“ nicht', () => {
  assert.deepEqual(decideServiceState({ ...base, current: 'operational', worstOpenImpact: 'partial' }), {
    target: 'partial',
    remember: null,
  })
})

test('merkt „Wartung“ nie und lässt sie nach dem Vorfall bestehen', () => {
  assert.deepEqual(decideServiceState({ ...base, current: 'maintenance', worstOpenImpact: 'major' }), {
    target: 'major',
    remember: null,
  })
  assert.deepEqual(decideServiceState({ ...base, current: 'maintenance', restore: true }), {
    target: 'maintenance',
    remember: null,
  })
})

test('zweiter offener Vorfall behält das Merkfeld und überschreibt es nicht', () => {
  assert.deepEqual(
    decideServiceState({ ...base, current: 'partial', remembered: 'degraded', worstOpenImpact: 'major', otherOpenIncidentsCoverService: true }),
    { target: 'major', remember: 'degraded' },
  )
})

test('zweiter Vorfall merkt den Zustand des ersten nicht nach, wenn das Merkfeld fehlt', () => {
  assert.deepEqual(
    decideServiceState({ ...base, current: 'partial', worstOpenImpact: 'major', otherOpenIncidentsCoverService: true }),
    { target: 'major', remember: null },
  )
})

test('Vorfall aus der Zeit vor der Migration wird nicht nachgemerkt', () => {
  assert.deepEqual(decideServiceState({ ...base, current: 'partial', worstOpenImpact: 'partial', wasCoveredBefore: true }), {
    target: 'partial',
    remember: null,
  })
})

test('Rückkehr in den gemerkten Zustand', () => {
  assert.deepEqual(decideServiceState({ ...base, current: 'partial', remembered: 'degraded', restore: true }), {
    target: 'degraded',
    remember: null,
  })
})

test('ohne Haken oder ohne gemerkten Zustand wird der Dienst betriebsbereit', () => {
  assert.deepEqual(decideServiceState({ ...base, current: 'partial', remembered: 'degraded', restore: false }), {
    target: 'operational',
    remember: null,
  })
  assert.deepEqual(decideServiceState({ ...base, current: 'partial', remembered: null, restore: true }), {
    target: 'operational',
    remember: null,
  })
})

type Update = { collection: string; id: number | string; data: Record<string, unknown> }

/** Fake-Payload: ein Dienst, die Liste der offenen Vorfälle, Aufzeichnung der Aktualisierungen. */
function fakePayload(service: Record<string, unknown>, openIncidents: Array<{ id: number; impact: string }>) {
  const updates: Update[] = []
  const payload = {
    findByID: async () => service,
    find: async () => ({ docs: openIncidents }),
    update: async (args: Update) => {
      updates.push({ collection: args.collection, id: args.id, data: args.data })
      return {}
    },
  } as unknown as Payload
  return { payload, updates }
}

test('Dienst ohne Zeile in serviceChoices wird betriebsbereit und das Merkfeld geleert', async () => {
  const { payload, updates } = fakePayload({ id: 1, status: 'partial', statusBeforeIncident: 'degraded' }, [])
  await syncServiceStatusesFromIncidents(payload, [1], undefined, { incidentId: 9, choices: [] })
  assert.deepEqual(updates, [{ collection: 'services', id: 1, data: { status: 'operational', statusBeforeIncident: null } }])
})

test('Zeile mit restore true führt in den gemerkten Zustand zurück (ID als Zahl oder Objekt)', async () => {
  for (const service of [1, { id: 1 }]) {
    const { payload, updates } = fakePayload({ id: 1, status: 'partial', statusBeforeIncident: 'degraded' }, [])
    await syncServiceStatusesFromIncidents(payload, [1], undefined, { incidentId: 9, choices: [{ service, restore: true }] })
    assert.deepEqual(updates, [{ collection: 'services', id: 1, data: { status: 'degraded', statusBeforeIncident: null } }])
  }
})

test('Löschen ohne choices: betriebsbereit, Merkfeld geleert', async () => {
  const { payload, updates } = fakePayload({ id: 1, status: 'partial', statusBeforeIncident: 'degraded' }, [])
  await syncServiceStatusesFromIncidents(payload, [1], undefined, { incidentId: 9 })
  assert.deepEqual(updates, [{ collection: 'services', id: 1, data: { status: 'operational', statusBeforeIncident: null } }])
})

test('erster Vorfall merkt den Zustand und setzt die Auswirkung', async () => {
  const { payload, updates } = fakePayload({ id: 1, status: 'degraded', statusBeforeIncident: null }, [{ id: 9, impact: 'partial' }])
  await syncServiceStatusesFromIncidents(payload, [1], undefined, { incidentId: 9, previouslyOpenServiceIds: [] })
  assert.deepEqual(updates, [{ collection: 'services', id: 1, data: { status: 'partial', statusBeforeIncident: 'degraded' } }])
})

test('zweiter offener Vorfall: kein Nachmerken, Zustand wird nach dem Ende des ersten nicht zurückgesetzt', async () => {
  const { payload, updates } = fakePayload({ id: 1, status: 'partial', statusBeforeIncident: 'degraded' }, [{ id: 10, impact: 'partial' }])
  await syncServiceStatusesFromIncidents(payload, [1], undefined, {
    incidentId: 9,
    previouslyOpenServiceIds: [1],
    choices: [{ service: 1, restore: true }],
  })
  assert.deepEqual(updates, [])
})

test('nichts zu ändern: kein update', async () => {
  const { payload, updates } = fakePayload({ id: 1, status: 'operational', statusBeforeIncident: null }, [])
  await syncServiceStatusesFromIncidents(payload, [1], undefined, { incidentId: 9 })
  assert.deepEqual(updates, [])
})

test('aus dem Vorfall entfernter Dienst ohne Zeile in serviceChoices: betriebsbereit wie heute', async () => {
  const { payload, updates } = fakePayload({ id: 2, status: 'major', statusBeforeIncident: 'degraded' }, [])
  await syncServiceStatusesFromIncidents(payload, [2], undefined, { incidentId: 9, previouslyOpenServiceIds: [2], choices: [{ service: 1, restore: true }] })
  assert.deepEqual(updates, [{ collection: 'services', id: 2, data: { status: 'operational', statusBeforeIncident: null } }])
})
