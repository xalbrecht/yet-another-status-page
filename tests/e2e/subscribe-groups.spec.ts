import { test, expect, type APIRequestContext } from '@playwright/test'
import { createServiceGroup } from '../utils/payload-helpers'

/**
 * Gruppenwahl bei der Anmeldung (#268, PR 2): `POST /api/subscribe` nimmt `allGroups` und `groups` an.
 *
 * Die Testumgebung hat weder SMTP-Server noch SMS-Konto. Der Test schaltet beides vorübergehend ein (ein SMTP-Server
 * auf Port 1 ist nicht erreichbar, der Mailversand scheitert und wird protokolliert) und danach wieder aus.
 * Eigene Absenderadresse je Test: Die Ratenbegrenzung (5 Anmeldungen je Adresse und Stunde) zählt sonst im selben Topf.
 */
test.describe.configure({ mode: 'serial' })

const stamp = Date.now()
let counter = 0
const unique = () => `${stamp}-${counter++}`
const ipFor = (n: number) => `198.51.100.${((stamp + 31 * n) % 250) + 1}`

type Subscriber = { id: number; allGroups: boolean; groups?: Array<number | { id: number }>; active: boolean }

async function setGlobal(request: APIRequestContext, slug: string, data: Record<string, unknown>) {
  const response = await request.post(`/api/globals/${slug}`, { data })
  expect(response.ok(), await response.text()).toBeTruthy()
}

async function findByEmail(request: APIRequestContext, email: string): Promise<Subscriber> {
  const response = await request.get(`/api/subscribers?where[email][equals]=${encodeURIComponent(email)}&depth=0&limit=2`)
  const docs = (await response.json()).docs as Subscriber[]
  expect(docs).toHaveLength(1)
  return docs[0]
}

const groupIds = (doc: Subscriber) => (doc.groups ?? []).map((g) => (typeof g === 'object' ? g.id : g))

test.describe('Anmeldung mit Gruppenwahl', { tag: ['@public', '@abonnenten'] }, () => {
  let groupA: number
  let groupB: number

  test.beforeAll(async ({ request }) => {
    await setGlobal(request, 'email-settings', { enabled: true, smtpHost: 'localhost', smtpPort: 1, smtpFromAddress: 'status@example.test' })
    const id = unique()
    groupA = (await createServiceGroup({ name: `Anmeldung A ${id}`, icon: 'Server' })).id
    groupB = (await createServiceGroup({ name: `Anmeldung B ${id}`, icon: 'Server' })).id
  })

  test.afterAll(async ({ request }) => {
    await setGlobal(request, 'email-settings', { enabled: false })
  })

  const subscribe = (request: APIRequestContext, ip: number, body: Record<string, unknown>) =>
    request.post('/api/subscribe', { data: { type: 'email', ...body }, headers: { 'x-forwarded-for': ipFor(ip) } })

  test('ohne Angabe gilt „alle Dienstgruppen“', async ({ request }) => {
    const email = `anmeldung-${unique()}@example.test`
    expect((await subscribe(request, 1, { email })).status()).toBe(200)
    const doc = await findByEmail(request, email)
    expect(doc.allGroups).toBe(true)
    expect(groupIds(doc)).toEqual([])
  })

  test('mit Auswahl wird die Wahl gespeichert', async ({ request }) => {
    const email = `anmeldung-${unique()}@example.test`
    expect((await subscribe(request, 2, { email, allGroups: false, groups: [groupA, groupB] })).status()).toBe(200)
    const doc = await findByEmail(request, email)
    expect(doc.allGroups).toBe(false)
    expect(groupIds(doc).sort()).toEqual([groupA, groupB].sort())
  })

  test('ungültige Wahl ergibt 400 und legt nichts an', async ({ request }) => {
    for (const [index, body] of [
      { allGroups: false },
      { allGroups: false, groups: [] },
      { allGroups: false, groups: [999999] },
      { allGroups: false, groups: ['abc'] },
    ].entries()) {
      const email = `anmeldung-${unique()}@example.test`
      const response = await subscribe(request, 3 + index, { email, ...body })
      expect(response.status(), JSON.stringify(body)).toBe(400)
      const found = await request.get(`/api/subscribers?where[email][equals]=${encodeURIComponent(email)}&depth=0`)
      expect((await found.json()).docs).toHaveLength(0)
    }
  })

  test('eine erneute Anmeldung nach der Abmeldung überschreibt die Wahl', async ({ request }) => {
    const email = `anmeldung-${unique()}@example.test`
    expect((await subscribe(request, 8, { email, allGroups: false, groups: [groupA] })).status()).toBe(200)
    const first = await findByEmail(request, email)
    expect((await request.patch(`/api/subscribers/${first.id}`, { data: { active: false } })).ok()).toBeTruthy()

    expect((await subscribe(request, 9, { email, allGroups: false, groups: [groupB] })).status()).toBe(200)
    const second = await findByEmail(request, email)
    expect(second.id).toBe(first.id)
    expect(second.active).toBe(true)
    expect(groupIds(second)).toEqual([groupB])

    expect((await request.patch(`/api/subscribers/${first.id}`, { data: { active: false } })).ok()).toBeTruthy()
    expect((await subscribe(request, 10, { email })).status()).toBe(200)
    const third = await findByEmail(request, email)
    expect(third.allGroups).toBe(true)
    expect(groupIds(third)).toEqual([])
  })
})
