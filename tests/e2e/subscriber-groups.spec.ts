import { test, expect, type APIRequestContext } from '@playwright/test'
import { createServiceGroup } from '../utils/payload-helpers'

/**
 * Gruppenwahl der Abonnenten (#268, PR 1)
 *
 * Ein Abonnent hat „alle Dienstgruppen“ (`allGroups`, Standard) oder eine Auswahl (`groups`, mindestens eine).
 * Die Zustellung nutzt die Wahl, die Empfängerzahl (`recipientCount` am Entwurf, `/api/subscribers/count`)
 * und der Versand dieselbe Regel. Die Testumgebung hat keinen SMTP-Server: Gemessen wird die Zahl der Empfänger.
 */
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
})
