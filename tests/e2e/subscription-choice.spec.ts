import { test, expect } from '@playwright/test'
import { createServiceGroup, createSubscriber } from '../utils/payload-helpers'

/**
 * Änderung der Gruppenwahl per Token (#268, PR 3): `GET`/`PUT /api/subscription/<token>`.
 * Die Route liest und ändert nur `allGroups` und `groups`, der Token ist der einzige Zugang (Abonnenten haben kein Konto).
 */
test.describe.configure({ mode: 'serial' })

const stamp = Date.now()
let counter = 0
const unique = () => `${stamp}-${counter++}`

type Stored = { id: number; email?: string; verified: boolean; active: boolean; unsubscribeToken: string; allGroups: boolean; groups?: Array<number | { id: number }> }

test.describe('Gruppenwahl per Token (API)', { tag: ['@api', '@abonnenten'] }, () => {
  let groupA: number
  let groupB: number

  test.beforeAll(async () => {
    const id = unique()
    groupA = (await createServiceGroup({ name: `Wahl A ${id}`, icon: 'Server' })).id
    groupB = (await createServiceGroup({ name: `Wahl B ${id}`, icon: 'Server' })).id
  })

  const fresh = () => createSubscriber({ type: 'email', email: `wahl-${unique()}@example.test` })
  const stored = async (request: import('@playwright/test').APIRequestContext, id: number) =>
    (await (await request.get(`/api/subscribers/${id}?depth=0`)).json()) as Stored

  test('GET liefert die Wahl und sonst nichts', async ({ request }) => {
    const sub = await fresh()
    const response = await request.get(`/api/subscription/${sub.unsubscribeToken}`)
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ allGroups: true, groups: [], active: true })
    const text = JSON.stringify(body)
    expect(text).not.toContain('example.test')
    expect(text).not.toContain(sub.unsubscribeToken)
  })

  test('PUT speichert die Auswahl und ändert nichts anderes', async ({ request }) => {
    const sub = await fresh()
    const before = await stored(request, sub.id)
    const response = await request.put(`/api/subscription/${sub.unsubscribeToken}`, { data: { allGroups: false, groups: [groupA, groupB, groupA] } })
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.allGroups).toBe(false)
    expect([...body.groups].sort()).toEqual([groupA, groupB].sort())
    expect(JSON.stringify(body)).not.toContain('example.test')

    const after = await stored(request, sub.id)
    expect(after.allGroups).toBe(false)
    expect((after.groups ?? []).map((g) => (typeof g === 'object' ? g.id : g)).sort()).toEqual([groupA, groupB].sort())
    expect(after.email).toBe(before.email)
    expect(after.verified).toBe(before.verified)
    expect(after.active).toBe(before.active)
    expect(after.unsubscribeToken).toBe(before.unsubscribeToken)

    // zurück auf „alle“
    expect((await request.put(`/api/subscription/${sub.unsubscribeToken}`, { data: { allGroups: true } })).status()).toBe(200)
    const reset = await stored(request, sub.id)
    expect(reset.allGroups).toBe(true)
    expect(reset.groups ?? []).toEqual([])
  })

  test('unbekannter Token ergibt 404 ohne Inhalt', async ({ request }) => {
    const get = await request.get('/api/subscription/unbekannter-token-0000')
    expect(get.status()).toBe(404)
    expect(await get.text()).toBe('')
    const put = await request.put('/api/subscription/unbekannter-token-0000', { data: { allGroups: true } })
    expect(put.status()).toBe(404)
    expect(await put.text()).toBe('')
  })

  test('abgemeldeter Eintrag: GET zeigt active false, PUT ergibt 409 und ändert nichts', async ({ request }) => {
    const sub = await fresh()
    expect((await request.patch(`/api/subscribers/${sub.id}`, { data: { active: false } })).ok()).toBeTruthy()
    const get = await request.get(`/api/subscription/${sub.unsubscribeToken}`)
    expect(get.status()).toBe(200)
    expect((await get.json()).active).toBe(false)
    const put = await request.put(`/api/subscription/${sub.unsubscribeToken}`, { data: { allGroups: false, groups: [groupA] } })
    expect(put.status()).toBe(409)
    const after = await stored(request, sub.id)
    expect(after.allGroups).toBe(true)
    expect(after.active).toBe(false)
  })

  test('ungültige Wahl ergibt 400 und ändert nichts', async ({ request }) => {
    const sub = await fresh()
    for (const data of [{ allGroups: false }, { allGroups: false, groups: [] }, { allGroups: false, groups: [999999] }, { allGroups: false, groups: ['abc'] }, { allGroups: 'ja' }]) {
      const response = await request.put(`/api/subscription/${sub.unsubscribeToken}`, { data })
      expect(response.status(), JSON.stringify(data)).toBe(400)
    }
    const after = await stored(request, sub.id)
    expect(after.allGroups).toBe(true)
    expect(after.groups ?? []).toEqual([])
  })
})

test.describe('Seite „Auswahl ändern“', { tag: ['@public', '@abonnenten'] }, () => {
  let groupA: number
  let groupB: number
  let nameA: string
  let nameB: string

  test.beforeAll(async () => {
    const id = unique()
    nameA = `Seite A ${id}`
    nameB = `Seite B ${id}`
    groupA = (await createServiceGroup({ name: nameA, icon: 'Server' })).id
    groupB = (await createServiceGroup({ name: nameB, icon: 'Server' })).id
  })

  const fresh = () => createSubscriber({ type: 'email', email: `seite-${unique()}@example.test` })
  const stored = async (request: import('@playwright/test').APIRequestContext, id: number) =>
    (await (await request.get(`/api/subscribers/${id}?depth=0`)).json()) as Stored

  test('zeigt „alle Dienstgruppen“, speichert die Auswahl und bestätigt', async ({ page, request }) => {
    const sub = await fresh()
    await page.goto(`/subscription/${sub.unsubscribeToken}`)
    const all = page.getByLabel(/All service groups|Alle Dienstgruppen/i)
    await expect(all).toBeChecked()
    // Hydrierung abwarten, sonst löst das Umschalten nichts aus
    await page.waitForFunction(() => Object.keys(document.querySelector('input[type="checkbox"]') ?? {}).some((k) => k.startsWith('__reactProps')))

    await all.uncheck()
    const save = page.getByRole('button', { name: /Save selection|Auswahl speichern/i })
    await expect(save).toBeDisabled()
    await page.getByRole('searchbox').fill(nameA)
    await page.getByLabel(nameA).check()
    await expect(save).toBeEnabled()
    await save.click()
    await expect(page.getByText(/selection has been saved|Auswahl ist gespeichert/i)).toBeVisible({ timeout: 10000 })

    const after = await stored(request, sub.id)
    expect(after.allGroups).toBe(false)
    expect((after.groups ?? []).map((g) => (typeof g === 'object' ? g.id : g))).toEqual([groupA])
  })

  test('zeigt die gespeicherte Auswahl an', async ({ page, request }) => {
    const sub = await fresh()
    expect((await request.put(`/api/subscription/${sub.unsubscribeToken}`, { data: { allGroups: false, groups: [groupB] } })).status()).toBe(200)
    await page.goto(`/subscription/${sub.unsubscribeToken}`)
    await expect(page.getByLabel(/All service groups|Alle Dienstgruppen/i)).not.toBeChecked()
    await expect(page.getByLabel(nameB)).toBeChecked()
    await expect(page.getByLabel(nameA)).not.toBeChecked()
  })

  test('falscher Token zeigt die Fehlerseite ohne Formular', async ({ page }) => {
    await page.goto('/subscription/unbekannter-token-0000')
    await expect(page.getByRole('heading', { name: /Invalid link|Ungültiger Link/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Save selection|Auswahl speichern/i })).toHaveCount(0)
  })

  test('abgemeldeter Eintrag zeigt „abgemeldet“ ohne Formular', async ({ page, request }) => {
    const sub = await fresh()
    expect((await request.patch(`/api/subscribers/${sub.id}`, { data: { active: false } })).ok()).toBeTruthy()
    await page.goto(`/subscription/${sub.unsubscribeToken}`)
    await expect(page.getByRole('heading', { name: /Unsubscribed|Abgemeldet/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Save selection|Auswahl speichern/i })).toHaveCount(0)
    await expect(page.getByLabel(/All service groups|Alle Dienstgruppen/i)).toHaveCount(0)
  })
})
