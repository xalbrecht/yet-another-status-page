import { test, expect, type APIRequestContext } from '@playwright/test'
import { ADMIN_STORAGE_STATE } from '../utils/admin-auth'
import { createService, createServiceGroup } from '../utils/payload-helpers'

/**
 * Gruppenwahl der Abonnenten (#268, PR 1)
 *
 * Ein Abonnent hat „alle Dienstgruppen“ (`allGroups`, Standard) oder eine Auswahl (`groups`, mindestens eine).
 * Die Zustellung nutzt die Wahl, die Empfängerzahl (`recipientCount` am Entwurf, `/api/subscribers/count`)
 * und der Versand dieselbe Regel. Die Testumgebung hat keinen SMTP-Server: Gemessen wird die Zahl der Empfänger.
 */
// Payload nimmt das Cookie nur an, wenn die Anfrage einen Origin der erlaubten Adresse trägt
const ORIGIN = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
test.use({ storageState: ADMIN_STORAGE_STATE, extraHTTPHeaders: { Origin: ORIGIN } })
test.describe.configure({ mode: 'serial' })

const stamp = Date.now()
let counter = 0
const unique = () => `${stamp}-${counter++}`

type Subscriber = { id: number; allGroups: boolean; groups?: Array<number | { id: number }> }

async function createSub(request: APIRequestContext, data: Record<string, unknown>) {
  return request.post('/api/subscribers', {
    data: { type: 'email', email: `gruppen-${unique()}@example.test`, active: true, verified: true, addressConfirmed: true, ...data },
  })
}

const groupIds = (doc: Subscriber) => (doc.groups ?? []).map((g) => (typeof g === 'object' ? g.id : g))

test.describe('Gruppenwahl der Abonnenten', { tag: ['@admin', '@abonnenten'] }, () => {
  let groupA: number
  let groupB: number

  test.beforeAll(async () => {
    const id = unique()
    groupA = (await createServiceGroup({ name: `Wahl A ${id}`, icon: 'Server' })).id
    groupB = (await createServiceGroup({ name: `Wahl B ${id}`, icon: 'Server' })).id
  })

  test('ein Abonnent ohne Angabe hat „alle Dienstgruppen“ und keine Auswahl', async ({ request }) => {
    const response = await createSub(request, {})
    expect(response.status()).toBe(201)
    const doc = (await response.json()).doc as Subscriber
    expect(doc.allGroups).toBe(true)
    expect(groupIds(doc)).toEqual([])
  })

  test('ohne „alle Dienstgruppen“ ist mindestens eine Gruppe nötig', async ({ request }) => {
    const empty = await createSub(request, { allGroups: false })
    expect(empty.status()).toBe(400)
    const emptyList = await createSub(request, { allGroups: false, groups: [] })
    expect(emptyList.status()).toBe(400)
    const ok = await createSub(request, { allGroups: false, groups: [groupA] })
    expect(ok.status()).toBe(201)
    const doc = (await ok.json()).doc as Subscriber
    expect(doc.allGroups).toBe(false)
    expect(groupIds(doc)).toEqual([groupA])
  })

  test('mit „alle Dienstgruppen“ wird die Auswahl geleert', async ({ request }) => {
    const response = await createSub(request, { allGroups: true, groups: [groupA] })
    expect(response.status()).toBe(201)
    const doc = (await response.json()).doc as Subscriber
    expect(doc.allGroups).toBe(true)
    expect(groupIds(doc)).toEqual([])
  })

  test('die Auswahl lässt sich nachträglich nicht leeren', async ({ request }) => {
    const created = await createSub(request, { allGroups: false, groups: [groupA, groupB] })
    const id = ((await created.json()).doc as Subscriber).id
    const emptied = await request.patch(`/api/subscribers/${id}`, { data: { groups: [] } })
    expect(emptied.status()).toBe(400)
    const narrowed = await request.patch(`/api/subscribers/${id}`, { data: { groups: [groupB] } })
    expect(narrowed.status()).toBe(200)
  })

  test('wird die letzte gewählte Gruppe gelöscht, gilt der Abonnent als „alle Dienstgruppen“', async ({ request }) => {
    const id = unique()
    const only = (await createServiceGroup({ name: `Löschen A ${id}`, icon: 'Server' })).id
    const other = (await createServiceGroup({ name: `Löschen B ${id}`, icon: 'Server' })).id
    const single = ((await (await createSub(request, { allGroups: false, groups: [only] })).json()).doc as Subscriber).id
    const both = ((await (await createSub(request, { allGroups: false, groups: [only, other] })).json()).doc as Subscriber).id

    const removed = await request.delete(`/api/service-groups/${only}`)
    expect(removed.status(), await removed.text()).toBe(200)

    const read = async (subscriber: number) => (await (await request.get(`/api/subscribers/${subscriber}?depth=0`)).json()) as Subscriber
    const afterSingle = await read(single)
    expect(afterSingle.allGroups).toBe(true)
    expect(groupIds(afterSingle)).toEqual([])
    const afterBoth = await read(both)
    expect(afterBoth.allGroups).toBe(false)
    expect(groupIds(afterBoth)).toEqual([other])
  })

  test('werden mehrere Gruppen auf einmal gelöscht, bleibt kein Abonnent ohne Gruppe zurück', async ({ request }) => {
    const id = unique()
    const first = (await createServiceGroup({ name: `Sammel A ${id}`, icon: 'Server' })).id
    const second = (await createServiceGroup({ name: `Sammel B ${id}`, icon: 'Server' })).id
    const third = (await createServiceGroup({ name: `Sammel C ${id}`, icon: 'Server' })).id
    const both = ((await (await createSub(request, { allGroups: false, groups: [first, second] })).json()).doc as Subscriber).id
    const partly = ((await (await createSub(request, { allGroups: false, groups: [first, third] })).json()).doc as Subscriber).id

    const removed = await request.delete(`/api/service-groups?where[id][in]=${first},${second}`)
    expect(removed.status(), await removed.text()).toBe(200)

    const read = async (subscriber: number) => (await (await request.get(`/api/subscribers/${subscriber}?depth=0`)).json()) as Subscriber
    const afterBoth = await read(both)
    expect(afterBoth.allGroups).toBe(true)
    expect(groupIds(afterBoth)).toEqual([])
    const afterPartly = await read(partly)
    expect(afterPartly.allGroups).toBe(false)
    expect(groupIds(afterPartly)).toEqual([third])
  })

  test('Empfängerzahl und Entwurf folgen der Wahl: nur passende Gruppen, sonst alle', async ({ request }) => {
    const id = unique()
    const startsAt = new Date(Date.now() - 5 * 86400000).toISOString()
    // Eigene Gruppen: Abonnenten der anderen Tests dürfen die Zahlen nicht verändern
    const groupA = (await createServiceGroup({ name: `Zähl A ${id}`, icon: 'Server' })).id
    const groupB = (await createServiceGroup({ name: `Zähl B ${id}`, icon: 'Server' })).id
    const groupC = (await createServiceGroup({ name: `Zähl C ${id}`, icon: 'Server' })).id
    const svcA = (await createService({ name: `Wahl DA ${id}`, group: groupA, startsAt })).id
    const svcB = (await createService({ name: `Wahl DB ${id}`, group: groupB, startsAt })).id
    const svcC = (await createService({ name: `Wahl DC ${id}`, group: groupC, startsAt })).id

    for (const extra of [{ allGroups: true }, { allGroups: false, groups: [groupA] }, { allGroups: false, groups: [groupB] }, { allGroups: false, groups: [groupA, groupB] }]) {
      expect((await createSub(request, extra)).status()).toBe(201)
    }

    const incident = async (services: number[]) => {
      const response = await request.post('/api/incidents', {
        data: { title: `Wahl ${unique()}`, impact: 'partial', affectedServices: services, updates: [{ status: 'investigating', message: 'Text' }] },
      })
      expect(response.status()).toBe(201)
      return (await response.json()).doc.id as number
    }
    const draft = async (relation: Record<string, unknown>) => {
      const response = await request.post('/api/notifications', { data: { title: `Entwurf ${unique()}`, channel: 'email', status: 'draft', subject: 'x', ...relation } })
      expect(response.status()).toBe(201)
      return (await response.json()).doc.id as number
    }
    const count = async (notification?: number) => {
      const query = notification ? `&notification=${notification}` : ''
      return ((await (await request.get(`/api/subscribers/count?channel=email${query}`)).json()) as { count: number }).count
    }
    const estimated = async (notification: number) => ((await (await request.get(`/api/notifications/${notification}?depth=0`)).json()) as { recipientCount: number }).recipientCount

    const total = await count()
    const onlyC = await draft({ relatedIncident: await incident([svcC]) })
    // Gruppe C wählt niemand: erreicht werden nur die Abonnenten mit „alle Dienstgruppen“ (der Bestand und der neue)
    const allOnly = await count(onlyC)
    expect(allOnly).toBeLessThan(total)

    const cases: Array<[string, number, number]> = [
      ['nur Gruppe A', await draft({ relatedIncident: await incident([svcA]) }), allOnly + 2],
      ['nur Gruppe B', await draft({ relatedIncident: await incident([svcB]) }), allOnly + 2],
      ['Gruppen A und B', await draft({ relatedIncident: await incident([svcA, svcB]) }), allOnly + 3],
      ['Wartung nur Gruppe A', await draft({ relatedMaintenance: await maintenance(request, [svcA]) }), allOnly + 2],
      ['ohne Bezug', await draft({}), total],
    ]
    for (const [name, notification, expected] of cases) {
      expect(await count(notification), `Zählung ${name}`).toBe(expected)
      expect(await estimated(notification), `Entwurf ${name}`).toBe(expected)
    }
    // Meldung ohne Dienste: alle
    const noServices = await request.post('/api/incidents', {
      data: { title: `Wahl ohne Dienste ${unique()}`, impact: 'partial', affectedServices: [], updates: [{ status: 'investigating', message: 'Text' }] },
    })
    expect(noServices.status()).toBe(201)
    const noServicesDraft = await draft({ relatedIncident: (await noServices.json()).doc.id })
    expect(await count(noServicesDraft)).toBe(total)
    expect(await estimated(noServicesDraft)).toBe(total)
  })

  test('Zählung: ungültige Kennung ergibt 400, unbekannte 404 (statt 500)', async ({ request }) => {
    // `1.5` und eine Zahl über dem Wertebereich der Spalte ließen die Abfrage in der Datenbank scheitern (500)
    for (const invalid of ['abc', '1.5', '99999999999']) {
      const response = await request.get(`/api/subscribers/count?channel=email&notification=${invalid}`)
      expect(response.status(), `Kennung ${invalid}`).toBe(400)
    }
    const unknown = await request.get('/api/subscribers/count?channel=email&notification=2000000000')
    expect(unknown.status()).toBe(404)
  })

  test('der Wert von „alle Dienstgruppen“ darf nicht leer sein', async ({ request }) => {
    const response = await createSub(request, { allGroups: null })
    expect(response.status()).toBe(400)
  })
})

async function maintenance(request: APIRequestContext, services: number[]) {
  const response = await request.post('/api/maintenances', {
    data: {
      title: `Wahl Wartung ${Date.now()}`,
      maintenanceKind: 'sla',
      status: 'upcoming',
      scheduledStartAt: new Date(Date.now() + 86400000).toISOString(),
      scheduledEndAt: new Date(Date.now() + 90000000).toISOString(),
      affectedServices: services,
    },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).doc.id as number
}
