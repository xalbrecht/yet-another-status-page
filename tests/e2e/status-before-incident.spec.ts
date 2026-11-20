import { test, expect, type APIRequestContext } from '@playwright/test'
import { createService, createServiceGroup, getService, updateService } from '../utils/payload-helpers'

/**
 * Zustand vor einem Vorfall (Issue #210): Der Dienst merkt sich den Zustand, den er vor dem ersten offenen Vorfall hatte,
 * und kehrt beim Ende des letzten offenen Vorfalls auf Wunsch dorthin zurück (Feld `serviceChoices` am Vorfall).
 */
const DAY = 24 * 3600 * 1000
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY).toISOString()

async function newService(label: string, status: 'degraded' | 'major' | 'operational') {
  const id = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const group = await createServiceGroup({ name: `Vorher Gruppe ${label} ${id}`, icon: 'Server' })
  const service = await createService({ name: `Vorher ${label} ${id}`, group: group.id, startsAt: daysFromNow(-5) })
  if (status !== 'operational') await updateService(service.id, { status })
  return service.id
}

async function openIncident(request: APIRequestContext, serviceIds: number[], impact = 'partial') {
  const response = await request.post('/api/incidents', {
    data: { title: 'Vorher Störung', impact, affectedServices: serviceIds, updates: [{ status: 'investigating', message: 'Text' }] },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).doc.id as number
}

async function resolve(request: APIRequestContext, incidentId: number, serviceChoices?: Array<{ service: number; restore: boolean }>) {
  const current = await (await request.get(`/api/incidents/${incidentId}?depth=0`)).json()
  const response = await request.patch(`/api/incidents/${incidentId}`, {
    data: {
      updates: [...current.updates, { status: 'resolved', message: 'Behoben' }],
      ...(serviceChoices ? { serviceChoices } : {}),
    },
  })
  expect(response.status()).toBe(200)
}

test.describe('Zustand vor dem Vorfall', { tag: ['@api', '@stoerungen', '@dienste'] }, () => {
  test('Rückkehr: Dienst „eingeschränkt“, Vorfall „Teilausfall“, Behebung mit Haken führt zurück', async ({ request }) => {
    const service = await newService('Rückkehr', 'degraded')
    const incident = await openIncident(request, [service])
    const during = await getService(service)
    expect(during.status).toBe('partial')
    expect(during.statusBeforeIncident).toBe('degraded')

    await resolve(request, incident, [{ service, restore: true }])
    const after = await getService(service)
    expect(after.status).toBe('degraded')
    expect(after.statusBeforeIncident ?? null).toBeNull()
  })

  test('Betriebsbereit, wenn der Haken fehlt', async ({ request }) => {
    const service = await newService('Ohne Haken', 'major')
    const incident = await openIncident(request, [service], 'degraded')
    // Der Handwert „Schwerer Ausfall“ bleibt beim Öffnen gemerkt, obwohl die Auswirkung milder ist
    expect((await getService(service)).statusBeforeIncident).toBe('major')

    await resolve(request, incident, [{ service, restore: false }])
    const after = await getService(service)
    expect(after.status).toBe('operational')
    expect(after.statusBeforeIncident ?? null).toBeNull()
  })

  test('Betriebsbereit, wenn serviceChoices in der Schnittstelle fehlt (heutiges Verhalten)', async ({ request }) => {
    const service = await newService('Ohne Feld', 'degraded')
    const incident = await openIncident(request, [service])
    await resolve(request, incident)
    expect((await getService(service)).status).toBe('operational')
  })

  test('Dienst ohne Zustand vorher wird nie als gemerkt geführt', async ({ request }) => {
    const service = await newService('Gesund', 'operational')
    const incident = await openIncident(request, [service])
    expect((await getService(service)).statusBeforeIncident ?? null).toBeNull()
    await resolve(request, incident, [{ service, restore: true }])
    expect((await getService(service)).status).toBe('operational')
  })

  test('Zwei Vorfälle: erst nach dem Ende des zweiten kehrt der Dienst zurück', async ({ request }) => {
    const service = await newService('Zwei', 'degraded')
    const first = await openIncident(request, [service])
    const second = await openIncident(request, [service], 'major')
    expect((await getService(service)).statusBeforeIncident).toBe('degraded')

    await resolve(request, first, [{ service, restore: true }])
    const between = await getService(service)
    expect(between.status).toBe('major')
    expect(between.statusBeforeIncident).toBe('degraded')

    await resolve(request, second, [{ service, restore: true }])
    expect((await getService(service)).status).toBe('degraded')
  })

  test('Gelöschter Vorfall setzt den Dienst auf „Betriebsbereit“ und leert das Merkfeld', async ({ request }) => {
    const service = await newService('Gelöscht', 'degraded')
    const incident = await openIncident(request, [service])
    const deleted = await request.delete(`/api/incidents/${incident}`)
    expect(deleted.status()).toBe(200)
    const after = await getService(service)
    expect(after.status).toBe('operational')
    expect(after.statusBeforeIncident ?? null).toBeNull()
  })

  test('Wiederöffnen und erneutes Beheben: alte Auswahl gilt nicht mehr, gemerkt wird einmal', async ({ request }) => {
    const service = await newService('Wieder', 'degraded')
    const incident = await openIncident(request, [service])
    await resolve(request, incident, [{ service, restore: false }])
    expect((await getService(service)).status).toBe('operational')

    // Wiederöffnen: Dienst war betriebsbereit, nichts zu merken
    const current = await (await request.get(`/api/incidents/${incident}?depth=0`)).json()
    const reopened = await request.patch(`/api/incidents/${incident}`, { data: { updates: [...current.updates, { status: 'monitoring', message: 'Wieder' }] } })
    expect(reopened.status()).toBe(200)
    expect(((await (await request.get(`/api/incidents/${incident}?depth=0`)).json()).serviceChoices ?? []).length).toBe(0)
    expect((await getService(service)).statusBeforeIncident ?? null).toBeNull()

    await resolve(request, incident)
    expect((await getService(service)).status).toBe('operational')
  })
})
