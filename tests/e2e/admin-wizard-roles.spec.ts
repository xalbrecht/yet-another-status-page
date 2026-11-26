import { test, expect, type APIRequestContext, type Browser, type BrowserContext, type Locator } from '@playwright/test'
import { ADMIN_STORAGE_STATE } from '../utils/admin-auth'
import { createService, createServiceGroup } from '../utils/payload-helpers'

/**
 * Assistent „Neu erstellen mit Vorlage“ je Rolle (Issue #285). Der Produktmanager legt Wartungen an, Störungen nicht:
 * Für ihn gibt es keine Wahl der Art, und der Assistent bietet nur die Dienste seiner Gruppen an.
 * Die Tests laufen als Admin (storageState), legen eigene Benutzer an und melden sie in einem eigenen Browserkontext an.
 */
const ORIGIN = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
test.use({ storageState: ADMIN_STORAGE_STATE, extraHTTPHeaders: { Origin: ORIGIN } })

const PASSWORD = 'e2e-assistent-Passwort-1'
const unique = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`

async function waitForHydration(element: Locator): Promise<void> {
  await expect
    .poll(() => element.evaluate((node) => Object.keys(node).some((key) => key.startsWith('__reactProps'))), { timeout: 30_000 })
    .toBe(true)
}

/** Legt einen Benutzer an, meldet ihn an und liefert einen Browserkontext mit seiner Sitzung. */
async function contextFor(browser: Browser, admin: APIRequestContext, data: Record<string, unknown>) {
  const email = `assistent-${unique()}@example.com`
  const response = await admin.post('/api/users', { data: { email, password: PASSWORD, ...data } })
  expect(response.status()).toBe(201)
  const userId = (await response.json()).doc.id as number
  // Eigener Browserkontext: Die Sitzung des Admins bleibt unberührt
  const context: BrowserContext = await browser.newContext({ baseURL: ORIGIN })
  const login = await context.request.post('/api/users/login', { data: { email, password: PASSWORD }, headers: { Origin: ORIGIN } })
  expect(login.status()).toBe(200)
  return { context, userId }
}

test.describe('Admin: Assistent je Rolle', { tag: ['@admin', '@wartungen', '@stoerungen', '@vorlagen'] }, () => {
  test('Produktmanager: Assistent nur für Wartungen mit den Diensten seiner Gruppen, Knopf bei Störungen fehlt', async ({ browser, request }) => {
    const id = unique()
    const startsAt = new Date(Date.now() - 5 * 86400000).toISOString()
    const groupA = await createServiceGroup({ name: `Assistent A ${id}`, icon: 'Server' })
    const groupB = await createServiceGroup({ name: `Assistent B ${id}`, icon: 'Server' })
    await createService({ name: `Assistent DA ${id}`, group: groupA.id, startsAt })
    await createService({ name: `Assistent DB ${id}`, group: groupB.id, startsAt })
    const { context, userId } = await contextFor(browser, request, { roles: ['produktmanager'], produktmanagerGruppen: [groupA.id] })
    const page = await context.newPage()
    try {
      // Wartung: Seite erreichbar, keine Wahl der Art, nur die eigene Gruppe in der Auswahl
      await page.goto('/admin/incident-from-template?kind=maintenance', { timeout: 120000 })
      const group = page.getByTestId('group')
      await waitForHydration(group)
      await expect(page.getByTestId('kind')).toHaveCount(0)
      await expect(page.getByTestId('wizard-maintenance')).toBeVisible()
      await expect(group.locator(`option[value="${groupA.id}"]`)).toHaveCount(1)
      await expect(group.locator(`option[value="${groupB.id}"]`)).toHaveCount(0)

      // Störung: Die Adresse öffnet ebenfalls nur die Wartung, die Art „Störung“ gibt es nicht
      await page.goto('/admin/incident-from-template?kind=incident')
      await waitForHydration(page.getByTestId('group'))
      await expect(page.getByTestId('kind')).toHaveCount(0)
      await expect(page.getByTestId('wizard-maintenance')).toBeVisible()
      await expect(page.getByTestId('wizard')).toHaveCount(0)

      // Liste „Wartungen“: Knopf da. Liste „Störungen“: Knopf fehlt
      await page.goto('/admin/collections/maintenances')
      await expect(page.getByTestId('new-maintenance-with-template')).toBeVisible()
      await page.goto('/admin/collections/incidents')
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      await expect(page.getByTestId('new-with-template')).toHaveCount(0)
    } finally {
      await context.close()
      await request.delete(`/api/users/${userId}`)
    }
  })

  test('ServiceDesk: Assistent mit Wahl der Art, Knopf bei Störungen vorhanden', async ({ browser, request }) => {
    const { context, userId } = await contextFor(browser, request, { roles: ['servicedesk'], servicedeskAlleGruppen: true })
    const page = await context.newPage()
    try {
      await page.goto('/admin/incident-from-template', { timeout: 120000 })
      await waitForHydration(page.getByTestId('kind'))
      await expect(page.getByTestId('kind-incident')).toBeChecked()
      await expect(page.getByTestId('kind-maintenance')).toBeVisible()
      await page.goto('/admin/collections/incidents')
      await expect(page.getByTestId('new-with-template')).toBeVisible()
    } finally {
      await context.close()
      await request.delete(`/api/users/${userId}`)
    }
  })

  test('Dashboard: Konto mit Gruppenliste zeigt „Meine Gruppen“ und „Gesamt“, Admin nur die Zahl (Issue #286)', async ({ browser, request, page }) => {
    const id = unique()
    const group = await createServiceGroup({ name: `Dashboard A ${id}`, icon: 'Server' })
    const desk = await contextFor(browser, request, { roles: ['servicedesk'], servicedeskGruppen: [group.id] })
    const pm = await contextFor(browser, request, { roles: ['produktmanager'], produktmanagerGruppen: [group.id] })
    const deskPage = await desk.context.newPage()
    const pmPage = await pm.context.newPage()
    try {
      // ServiceDesk: vier Kacheln mit zwei Zahlen, Produktmanager: zwei Kacheln (Störungen und Wartungen)
      await deskPage.goto('/admin', { timeout: 120000 })
      await expect(deskPage.getByTestId('count-total')).toHaveCount(4, { timeout: 30000 })
      await expect(deskPage.getByTestId('count-own')).toHaveCount(4)
      await pmPage.goto('/admin', { timeout: 120000 })
      await expect(pmPage.getByTestId('count-total')).toHaveCount(2, { timeout: 30000 })
      // Admin: eine Zahl je Kachel, keine zweite
      await page.goto('/admin', { timeout: 120000 })
      await expect(page.locator('.dashboard-widget')).toHaveCount(6, { timeout: 30000 })
      await expect(page.getByTestId('count-total')).toHaveCount(0)
    } finally {
      await desk.context.close()
      await pm.context.close()
      await request.delete(`/api/users/${desk.userId}`)
      await request.delete(`/api/users/${pm.userId}`)
    }
  })
})
