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
// Zufällige Adresse aus dem Testbereich 198.18.0.0/15: Kollisionen mit anderen Tests und früheren Läufen sind praktisch ausgeschlossen
const ips = new Map<number, string>()
const ipFor = (n: number) => {
  if (!ips.has(n)) ips.set(n, `198.18.${Math.floor(Math.random() * 256)}.${1 + Math.floor(Math.random() * 254)}`)
  return ips.get(n)!
}

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
  let stampOfGroups: string

  test.beforeAll(async ({ request }) => {
    await setGlobal(request, 'email-settings', { enabled: true, smtpHost: 'localhost', smtpPort: 1, smtpFromAddress: 'status@example.test' })
    const id = unique()
    stampOfGroups = id
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

  test('der Dialog bietet „alle Dienstgruppen“, eine suchbare Auswahl und sendet die Wahl', async ({ page, request }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Subscribe/i }).first().click()
    const all = page.getByLabel(/All service groups|Alle Dienstgruppen/i)
    await expect(all).toBeChecked()
    await expect(page.getByRole('searchbox')).toHaveCount(0)

    await all.uncheck()
    const submit = page.getByRole('button', { name: /^Subscribe$|^Abonnieren$/ })
    await expect(submit).toBeDisabled()
    await expect(page.getByText(/Choose at least one service group|Mindestens eine Dienstgruppe wählen/)).toBeVisible()

    // Suche begrenzt die Liste auf passende Gruppen
    const search = page.getByRole('searchbox')
    await search.fill(`Anmeldung A ${stampOfGroups}`)
    await expect(page.getByLabel(`Anmeldung A ${stampOfGroups}`)).toBeVisible()
    await expect(page.getByLabel(`Anmeldung B ${stampOfGroups}`)).toHaveCount(0)
    await page.getByLabel(`Anmeldung A ${stampOfGroups}`).check()
    await expect(submit).toBeEnabled()

    const email = `dialog-${unique()}@example.test`
    await page.getByLabel(/Email Address|E-Mail-Adresse/i).fill(email)
    const sent = page.waitForRequest((r) => r.url().endsWith('/api/subscribe') && r.method() === 'POST')
    await submit.click()
    const body = (await sent).postDataJSON() as { allGroups: boolean; groups: number[] }
    expect(body.allGroups).toBe(false)
    expect(body.groups).toEqual([groupA])
    await expect(page.getByText(/receive status updates|künftig an/i)).toBeVisible({ timeout: 10000 })

    const stored = await findByEmail(request, email)
    expect(stored.allGroups).toBe(false)
    expect(groupIds(stored)).toEqual([groupA])
  })
})
