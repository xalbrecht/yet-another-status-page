import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import { decideServiceState, syncServiceStatusesFromIncidents } from '@/lib/service-status-sync'
import { Incidents } from '@/collections/Incidents'

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

// Verdrahtung in der Collection „Störungen“

type Hook = (args: Record<string, unknown>) => Promise<unknown> | unknown

async function runHooks(hooks: unknown[] | undefined, args: Record<string, unknown>) {
  for (const hook of (hooks ?? []) as Hook[]) await hook(args)
}

const hookRequest = (payload: Payload) => ({ payload, context: { skipNotificationCreation: true } })

test('afterChange gibt Vorfall, frühere Dienste und Auswahl an die Berechnung: Behebung kehrt zurück', async () => {
  const { payload, updates } = fakePayload({ id: 1, status: 'partial', statusBeforeIncident: 'degraded' }, [])
  await runHooks(Incidents.hooks?.afterChange, {
    doc: { id: 9, status: 'resolved', affectedServices: [1], serviceChoices: [{ service: 1, restore: true }] },
    previousDoc: { id: 9, status: 'investigating', affectedServices: [1] },
    operation: 'update',
    req: hookRequest(payload),
  })
  assert.deepEqual(updates, [{ collection: 'services', id: 1, data: { status: 'degraded', statusBeforeIncident: null } }])
})

test('afterChange: neuer Vorfall merkt den Zustand (previousDoc leer)', async () => {
  const { payload, updates } = fakePayload({ id: 1, status: 'degraded', statusBeforeIncident: null }, [{ id: 9, impact: 'partial' }])
  await runHooks(Incidents.hooks?.afterChange, {
    doc: { id: 9, status: 'investigating', impact: 'partial', affectedServices: [1] },
    previousDoc: {},
    operation: 'create',
    req: hookRequest(payload),
  })
  assert.deepEqual(updates, [{ collection: 'services', id: 1, data: { status: 'partial', statusBeforeIncident: 'degraded' } }])
})

test('afterChange: wieder geöffneter Vorfall merkt den Zustand erneut', async () => {
  const { payload, updates } = fakePayload({ id: 1, status: 'major', statusBeforeIncident: null }, [{ id: 9, impact: 'partial' }])
  await runHooks(Incidents.hooks?.afterChange, {
    doc: { id: 9, status: 'investigating', affectedServices: [1] },
    previousDoc: { id: 9, status: 'resolved', affectedServices: [1] },
    operation: 'update',
    req: hookRequest(payload),
  })
  assert.deepEqual(updates, [{ collection: 'services', id: 1, data: { status: 'partial', statusBeforeIncident: 'major' } }])
})

test('afterChange: offener Vorfall aus der Zeit vor dem Merkfeld wird bei neuer Aktualisierung nicht nachgemerkt', async () => {
  const { payload, updates } = fakePayload({ id: 1, status: 'partial', statusBeforeIncident: null }, [{ id: 9, impact: 'partial' }])
  await runHooks(Incidents.hooks?.afterChange, {
    doc: { id: 9, status: 'monitoring', impact: 'partial', affectedServices: [1] },
    previousDoc: { id: 9, status: 'investigating', affectedServices: [1] },
    operation: 'update',
    req: hookRequest(payload),
  })
  assert.deepEqual(updates, [])
})

test('afterDelete: gelöschter Vorfall setzt betriebsbereit und leert das Merkfeld', async () => {
  const { payload, updates } = fakePayload({ id: 1, status: 'partial', statusBeforeIncident: 'degraded' }, [])
  await runHooks(Incidents.hooks?.afterDelete, { doc: { id: 9, affectedServices: [1] }, req: hookRequest(payload) })
  assert.deepEqual(updates, [{ collection: 'services', id: 1, data: { status: 'operational', statusBeforeIncident: null } }])
})

test('beforeChange leert serviceChoices, wenn die letzte Aktualisierung nicht „Behoben“ ist', async () => {
  const [hook] = (Incidents.hooks?.beforeChange ?? []) as Hook[]
  const choices = [{ service: 1, restore: false }]
  const reopened = (await hook({
    data: { updates: [{ status: 'resolved' }, { status: 'monitoring' }], serviceChoices: choices },
    operation: 'update',
    originalDoc: { shortId: 'abc' },
  })) as Record<string, unknown>
  assert.deepEqual(reopened.serviceChoices, [])
  const resolved = (await hook({
    data: { updates: [{ status: 'investigating' }, { status: 'resolved' }], serviceChoices: choices },
    operation: 'update',
    originalDoc: { shortId: 'abc' },
  })) as Record<string, unknown>
  assert.deepEqual(resolved.serviceChoices, choices)
})
