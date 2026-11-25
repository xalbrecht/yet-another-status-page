import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { createService, createServiceGroup, getService, updateService } from '../utils/payload-helpers'
import { ADMIN_STORAGE_STATE, warmUpAdmin } from '../utils/admin-auth'
import { getWithReset } from '../utils/api-retry'

/**
 * Eigene Admin-Komponente „Dienste nach der Behebung“ (Issue #237, Feld aus Issue #210).
 * Die Tests laufen angemeldet (storageState aus `global-setup.ts`) und prüfen, was die Komponente im Browser tut.
 * Die Fachregeln (Zustand merken, zurückkehren) prüft `status-before-incident.spec.ts` über die Schnittstelle.
 */
test.use({ storageState: ADMIN_STORAGE_STATE })

const DAY = 24 * 3600 * 1000

async function newDegradedService(label: string) {
  const id = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const group = await createServiceGroup({ name: `Admin Gruppe ${label} ${id}`, icon: 'Server' })
  const service = await createService({ name: `Admin ${label} ${id}`, group: group.id, startsAt: new Date(Date.now() - 5 * DAY).toISOString() })
  await updateService(service.id, { status: 'degraded' })
  return { id: service.id, name: service.name }
}

async function openIncident(request: APIRequestContext, serviceIds: number[]) {
  const response = await request.post('/api/incidents', {
    data: { title: 'Admin Störung', impact: 'partial', affectedServices: serviceIds, updates: [{ status: 'investigating', message: 'Text' }] },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).doc.id as number
}

async function getIncident(request: APIRequestContext, id: number) {
  // Der erste Abruf nach längerem Leerlauf kann eine vom Server geschlossene Verbindung treffen (#278)
  return (await (await getWithReset(request, `/api/incidents/${id}?depth=0`)).json()) as {
    status: string
    serviceChoices?: Array<{ service: number; restore: boolean }>
  }
}

/** Fügt im Formular die Aktualisierung „Behoben“ hinzu (die zweite Zeile, die erste ist „Wird untersucht“). */
async function addResolvedUpdate(page: Page) {
  await page.getByRole('button', { name: 'Add Update' }).click()
  await page.locator('#field-updates__1__status').click()
  await page.keyboard.type('Resolved')
  await page.keyboard.press('Enter')
  await page.locator('#field-updates__1__message').fill('Behoben')
}

const choiceRows = (page: Page) => page.locator('[data-testid="service-choice"]')

test.describe('Admin: Dienste nach der Behebung', { tag: ['@admin', '@stoerungen', '@dienste'] }, () => {
  // Ein Worker und 120 s je Test: Der erste Aufruf einer Admin-Seite kompiliert im Dev-Server 25 bis 40 s, und lokal liefe sonst
  // jeder Worker das Anwärmen selbst und gegen das Standard-Timeout von 30 s (Issue #247)
  test.describe.configure({ mode: 'serial', timeout: 120_000 })

  // Der erste Aufruf kompiliert die Admin-Seiten im Dev-Server und dauert lange.
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240000)
    const page = await browser.newPage({ storageState: ADMIN_STORAGE_STATE })
    await warmUpAdmin(page)
    await page.close()
  })

  test('Admin-Panel öffnet angemeldet', async ({ page }) => {
    await page.goto('/admin/collections/incidents')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page).not.toHaveURL(/\/admin\/(login|create-first-user)/)
  })

  test('ist vorbelegt „Zurück“, und Speichern führt den Dienst in den gemerkten Zustand zurück', async ({ page, request }) => {
    const service = await newDegradedService('Zurück')
    const incident = await openIncident(request, [service.id])

    await page.goto(`/admin/collections/incidents/${incident}`)
    await addResolvedUpdate(page)

    await expect(choiceRows(page)).toHaveCount(1)
    await expect(choiceRows(page).first().locator('input[type="checkbox"]')).toBeChecked()
    await expect(choiceRows(page).first()).toContainText('Degraded Performance')

    await page.locator('#action-save').click()
    await expect.poll(async () => (await getIncident(request, incident)).status).toBe('resolved')
    expect((await getIncident(request, incident)).serviceChoices).toEqual([expect.objectContaining({ service: service.id, restore: true })])
    await expect.poll(async () => (await getService(service.id)).status).toBe('degraded')
  })

  test('Abwählen und Speichern setzt den Dienst auf „Betriebsbereit“', async ({ page, request }) => {
    const { id: service } = await newDegradedService('Abwählen')
    const incident = await openIncident(request, [service])

    await page.goto(`/admin/collections/incidents/${incident}`)
    await addResolvedUpdate(page)
    await expect(choiceRows(page)).toHaveCount(1)
    await choiceRows(page).first().locator('input[type="checkbox"]').uncheck()
    await page.locator('#action-save').click()

    await expect.poll(async () => (await getIncident(request, incident)).status).toBe('resolved')
    expect((await getIncident(request, incident)).serviceChoices).toEqual([expect.objectContaining({ service, restore: false })])
    await expect.poll(async () => (await getService(service)).status).toBe('operational')
  })

  test('blendet einen Dienst aus, der noch einen weiteren offenen Vorfall hat', async ({ page, request }) => {
    const free = await newDegradedService('Frei')
    const shared = await newDegradedService('Geteilt')
    const first = await openIncident(request, [free.id, shared.id])
    await openIncident(request, [shared.id])

    await page.goto(`/admin/collections/incidents/${first}`)
    await addResolvedUpdate(page)

    // Die Wahl wirkt erst beim Ende des letzten Vorfalls. Die Zeile des freien Dienstes ist der Anker: Sie erscheint,
    // erst dann sagt das Fehlen der zweiten Zeile etwas aus.
    await expect(choiceRows(page)).toHaveCount(1)
    await expect(choiceRows(page).first()).toContainText(free.name)
    await expect(page.locator('[data-testid="service-choices"]')).not.toContainText(shared.name)

    // Mit Speichern enden: Ein Formular mit ungespeicherten Änderungen lässt die Störung rund 5 Minuten gesperrt (HTTP 423
    // beim Löschen), und `clearCollection` anderer Spezifikationen lässt sie dann offen auf der Statusseite stehen.
    await page.locator('#action-save').click()
    await expect.poll(async () => (await getIncident(request, first)).status).toBe('resolved')
  })

  test('lässt einen alten, behobenen Vorfall beim Öffnen unverändert', async ({ page, request }) => {
    const { id: service } = await newDegradedService('Alt')
    const incident = await openIncident(request, [service])
    const response = await request.patch(`/api/incidents/${incident}`, {
      data: {
        updates: [{ status: 'investigating', message: 'Text' }, { status: 'resolved', message: 'Behoben' }],
        serviceChoices: [{ service, restore: true }],
      },
    })
    expect(response.status()).toBe(200)
    // Mit der Behebung löscht der Dienst seinen gemerkten Zustand. Hier steht er wieder im Dienst (so wie bei einem Vorfall
    // aus der Zeit vor der Migration), damit eine fälschlich wirksame Auswahl beim Öffnen eine Zeile anlegen würde.
    await updateService(service, { statusBeforeIncident: 'degraded' })
    expect((await getService(service)).statusBeforeIncident).toBe('degraded')

    // Die Komponente lädt beim Öffnen Dienste und weitere Vorfälle. Erst danach sagt „keine Zeile“ etwas aus.
    const servicesLoaded = page.waitForResponse((r) => decodeURIComponent(r.url()).includes('/api/services?where[id][in]'))
    const othersLoaded = page.waitForResponse((r) => r.url().includes('/api/incidents?') && r.url().includes('affectedServices'))
    await page.goto(`/admin/collections/incidents/${incident}`)
    await expect(page.locator('#field-updates__1__message')).toHaveValue('Behoben')
    await Promise.all([servicesLoaded, othersLoaded])
    await page.waitForTimeout(1000) // Zeit zum Rendern, falls die Komponente doch Zeilen anlegt

    // Kein Auswahlbereich, und das Formular gilt nicht als geändert (der Speichern-Knopf bleibt gesperrt).
    await expect(choiceRows(page)).toHaveCount(0)
    await expect(page.locator('#action-save')).toBeDisabled()
  })
})
