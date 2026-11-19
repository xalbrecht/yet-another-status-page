import { test, expect, type APIRequestContext } from '@playwright/test'
import { createService, createServiceGroup } from '../utils/payload-helpers'

/**
 * Haken „Meldungsentwurf anlegen“ (Issue #217): Wartungen und Störungen erzeugen beim Anlegen und mit jeder neuen Aktualisierung
 * einen Benachrichtigungsentwurf, solange der Haken nicht abgewählt ist. Ohne Angabe gilt „angehakt“ (bisheriges Verhalten).
 * Die Entwürfe entstehen nach dem Ende der Transaktion, deshalb wartet jeder Test auf den erwarteten Entwurf und prüft das Fehlen
 * erst danach über einen Vergleichsfall, der im selben Lauf einen Entwurf bekommt.
 */
const DAY = 24 * 3600 * 1000
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY).toISOString()

async function draftCount(request: APIRequestContext, relation: 'relatedMaintenance' | 'relatedIncident', id: number): Promise<number> {
  const response = await request.get(`/api/notifications?where[${relation}][equals]=${id}&limit=50&depth=0`)
  return (await response.json()).totalDocs as number
}

async function waitForDrafts(request: APIRequestContext, relation: 'relatedMaintenance' | 'relatedIncident', id: number, expected: number) {
  await expect.poll(() => draftCount(request, relation, id), { timeout: 20_000 }).toBe(expected)
}

async function newService(request: APIRequestContext, label: string) {
  void request
  const id = Date.now()
  const group = await createServiceGroup({ name: `Haken ${label} Gruppe ${id}`, icon: 'Server' })
  return createService({ name: `Haken ${label} Dienst ${id}`, group: group.id })
}

async function createMaintenanceRest(request: APIRequestContext, serviceId: number, extra: Record<string, unknown>) {
  const response = await request.post('/api/maintenances', {
    data: {
      title: `Haken Wartung ${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      maintenanceKind: 'sla',
      status: 'upcoming',
      scheduledStartAt: daysFromNow(2),
      affectedServices: [serviceId],
      ...extra,
    },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).doc as { id: number }
}

async function createIncidentRest(request: APIRequestContext, serviceId: number, firstUpdate: Record<string, unknown>) {
  const response = await request.post('/api/incidents', {
    data: {
      title: `Haken Störung ${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      impact: 'degraded',
      affectedServices: [serviceId],
      updates: [{ status: 'investigating', message: 'Wir untersuchen.', createdAt: new Date().toISOString(), ...firstUpdate }],
    },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).doc as { id: number }
}

test.describe('Haken „Meldungsentwurf anlegen“', { tag: ['@admin', '@wartungen', '@stoerungen'] }, () => {
  test('Wartung anlegen: ohne Angabe und angehakt entsteht ein Entwurf, abgewählt keiner', async ({ request }) => {
    const service = await newService(request, 'Wartung anlegen')
    // Die abgewählten Fälle entstehen zuerst: Ihr Entwurf würde vor dem der Vergleichsfälle entstehen und wäre beim Zählen schon da
    const unchecked = await createMaintenanceRest(request, service.id, { createNotificationDraft: false })
    const firstUpdateUnchecked = await createMaintenanceRest(request, service.id, {
      updates: [{ status: 'upcoming', message: 'Nachgetragen.', createdAt: new Date().toISOString(), createNotificationDraft: false }],
    })
    const withDefault = await createMaintenanceRest(request, service.id, {})
    const checked = await createMaintenanceRest(request, service.id, { createNotificationDraft: true })

    await waitForDrafts(request, 'relatedMaintenance', withDefault.id, 1)
    await waitForDrafts(request, 'relatedMaintenance', checked.id, 1)
    expect(await draftCount(request, 'relatedMaintenance', unchecked.id)).toBe(0)
    // Auch der Haken der ersten Aktualisierung wirkt beim Anlegen: Ihr Text gelangt sonst in einen Entwurf, den niemand wollte
    expect(await draftCount(request, 'relatedMaintenance', firstUpdateUnchecked.id)).toBe(0)
  })

  test('Aktualisierung einer Wartung: nur die angehakte Aktualisierung erzeugt einen Entwurf', async ({ request }) => {
    const service = await newService(request, 'Wartung Update')
    const created = await createMaintenanceRest(request, service.id, { createNotificationDraft: false })
    const first = { status: 'upcoming', message: 'Ankündigung.', createdAt: new Date().toISOString() }
    const silent = { status: 'in_progress', message: 'Nachgetragen.', createdAt: new Date().toISOString(), createNotificationDraft: false }
    const loud = { status: 'completed', message: 'Fertig.', createdAt: new Date().toISOString() }

    // Erste Aktualisierung abgewählt: kein Entwurf
    const afterSilent = await request.patch(`/api/maintenances/${created.id}`, { data: { updates: [{ ...first, createNotificationDraft: false }, silent] } })
    expect(afterSilent.status()).toBe(200)
    // Dritte Aktualisierung mit Vorgabe: ein Entwurf
    const afterLoud = await request.patch(`/api/maintenances/${created.id}`, { data: { updates: [{ ...first, createNotificationDraft: false }, silent, loud] } })
    expect(afterLoud.status()).toBe(200)

    await waitForDrafts(request, 'relatedMaintenance', created.id, 1)
    const drafts = (await (await request.get(`/api/notifications?where[relatedMaintenance][equals]=${created.id}&depth=0`)).json()).docs as Array<{ updateIndex: number }>
    expect(drafts.map((draft) => draft.updateIndex)).toEqual([2])
  })

  test('Störung anlegen: die erste Aktualisierung steuert den Entwurf', async ({ request }) => {
    const service = await newService(request, 'Störung anlegen')
    const unchecked = await createIncidentRest(request, service.id, { createNotificationDraft: false })
    const withDefault = await createIncidentRest(request, service.id, {})

    await waitForDrafts(request, 'relatedIncident', withDefault.id, 1)
    expect(await draftCount(request, 'relatedIncident', unchecked.id)).toBe(0)
  })

  test('Aktualisierung einer Störung: nur die angehakte Aktualisierung erzeugt einen Entwurf', async ({ request }) => {
    const service = await newService(request, 'Störung Update')
    const created = await createIncidentRest(request, service.id, { createNotificationDraft: false })
    const first = { status: 'investigating', message: 'Wir untersuchen.', createdAt: new Date().toISOString(), createNotificationDraft: false }
    const silent = { status: 'identified', message: 'Ursache gefunden.', createdAt: new Date().toISOString(), createNotificationDraft: false }
    const loud = { status: 'resolved', message: 'Behoben.', createdAt: new Date().toISOString() }

    expect((await request.patch(`/api/incidents/${created.id}`, { data: { updates: [first, silent] } })).status()).toBe(200)
    expect((await request.patch(`/api/incidents/${created.id}`, { data: { updates: [first, silent, loud] } })).status()).toBe(200)

    await waitForDrafts(request, 'relatedIncident', created.id, 1)
    const drafts = (await (await request.get(`/api/notifications?where[relatedIncident][equals]=${created.id}&depth=0`)).json()).docs as Array<{ updateIndex: number }>
    expect(drafts.map((draft) => draft.updateIndex)).toEqual([2])
  })

  test('Routen „aus Vorlage“: abgewählt entsteht kein Entwurf, ohne Angabe einer, ein Text wird abgewiesen', async ({ request }) => {
    const service = await newService(request, 'Vorlage')
    const maintenance = { title: 'Haken Vorlage Wartung', message: 'Arbeiten.', maintenanceKind: 'sla', serviceIds: [service.id], start: daysFromNow(2) }
    const incident = { title: 'Haken Vorlage Störung', message: 'Wir untersuchen.', impact: 'degraded', serviceIds: [service.id] }

    const maintenanceQuiet = await (await request.post('/api/maintenances/from-template', { data: { ...maintenance, createNotificationDraft: false } })).json()
    const incidentQuiet = await (await request.post('/api/incidents/from-template', { data: { ...incident, createNotificationDraft: false } })).json()
    const maintenanceDefault = await (await request.post('/api/maintenances/from-template', { data: maintenance })).json()
    const incidentDefault = await (await request.post('/api/incidents/from-template', { data: incident })).json()

    await waitForDrafts(request, 'relatedMaintenance', maintenanceDefault.id, 1)
    await waitForDrafts(request, 'relatedIncident', incidentDefault.id, 1)
    expect(await draftCount(request, 'relatedMaintenance', maintenanceQuiet.id)).toBe(0)
    expect(await draftCount(request, 'relatedIncident', incidentQuiet.id)).toBe(0)

    const bad = await request.post('/api/maintenances/from-template', { data: { ...maintenance, createNotificationDraft: 'nein' } })
    expect(bad.status()).toBe(400)
    expect((await bad.json()).fields).toEqual(['createNotificationDraft'])
  })
})
