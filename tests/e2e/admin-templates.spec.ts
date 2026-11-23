import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { createService, createServiceGroup, getService } from '../utils/payload-helpers'
import { ADMIN_STORAGE_STATE, warmUpAdmin } from '../utils/admin-auth'

/**
 * Eigene Admin-Komponenten rund um Vorlagen (Issue #241, Anmeldung aus Issue #237):
 *  - Assistent „Neu erstellen mit Vorlage“ für eine Störung und für eine Wartung (`incident-wizard`)
 *  - Auswahl „Vorlage einfügen“ bei einer neuen Aktualisierung (`update-template`)
 * Die Fachregeln der Routen prüfen `incident-from-template.spec.ts` und `maintenance-from-template.spec.ts` über die Schnittstelle.
 *
 * Jeder Test räumt seine Störung bzw. Wartung am Ende weg: Die Meldungen stehen sonst auf der Statusseite und zählen in den
 * Tests anderer Spezifikationen mit. Ein Formular mit ungespeicherten Änderungen würde die Störung rund 5 Minuten sperren
 * (HTTP 423 beim Löschen), deshalb endet der Test der Vorlagen-Auswahl mit Speichern.
 */
test.use({ storageState: ADMIN_STORAGE_STATE })

const DAY = 24 * 3600 * 1000

async function newService(label: string) {
  const id = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const group = await createServiceGroup({ name: `Vorlage Gruppe ${label} ${id}`, icon: 'Server' })
  const service = await createService({ name: `Vorlage ${label} ${id}`, group: group.id, startsAt: new Date(Date.now() - 5 * DAY).toISOString() })
  return { id, groupId: group.id, serviceId: service.id, name: service.name, groupName: group.name }
}

async function createTemplate(request: APIRequestContext, data: Record<string, unknown>) {
  const response = await request.post('/api/message-templates', { data })
  expect(response.status(), await response.text()).toBe(201)
  return (await response.json()).doc.id as number
}

/** Wartet, bis React ein Element hydriert hat. Vorher reagiert es nicht auf Eingaben (siehe `status-boxes.spec.ts`). */
async function waitForHydration(element: Locator): Promise<void> {
  await expect
    .poll(() => element.evaluate((node) => Object.keys(node).some((key) => key.startsWith('__reactProps'))), { timeout: 30_000 })
    .toBe(true)
}

/** Löscht Datensätze, deren Titel die Kennung enthält (ein gesperrtes Dokument antwortet 423 und bleibt stehen). */
async function removeByTitle(request: APIRequestContext, collection: 'incidents' | 'maintenances', id: string) {
  const list = await (await request.get(`/api/${collection}?where[title][contains]=${encodeURIComponent(id)}&depth=0&limit=50`)).json()
  for (const doc of list.docs ?? []) await request.delete(`/api/${collection}/${doc.id}`)
}

/**
 * „Jetzt veröffentlichen“ liegt am unteren Rand unter dem Hinweisfeld „Insight“ der Next.js-Entwicklungsansicht. Ein echter
 * Mausklick träfe dieses Feld, deshalb löst der Test den Klick am Knopf selbst aus.
 */
async function publish(page: Page) {
  const button = page.getByTestId('publish')
  await expect(button).toBeVisible()
  await expect(button).toBeEnabled()
  await button.dispatchEvent('click')
}

test.describe('Admin: Vorlagen', { tag: ['@admin', '@vorlagen', '@stoerungen', '@wartungen'] }, () => {
  // Der erste Aufruf kompiliert die Admin-Seiten im Dev-Server und dauert lange.
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240000)
    const page = await browser.newPage({ storageState: ADMIN_STORAGE_STATE })
    await warmUpAdmin(page)
    await page.close()
  })

  test('Assistent „Störung mit Vorlage“: Titel und Text kommen aus der Vorlage, Veröffentlichen setzt den Dienstzustand', async ({ page, request }) => {
    const s = await newService('Störung')
    const templateId = await createTemplate(request, {
      name: `Vorlage Wird untersucht ${s.id}`,
      kind: 'incident',
      status: 'investigating',
      title: 'Störung: {{services}}',
      body: 'Betroffen: {{services}} ({{group}}).',
    })

    try {
      await page.goto('/admin/incident-from-template')
      await waitForHydration(page.getByTestId('group'))
      await page.getByTestId('group').selectOption(String(s.groupId))
      await page.getByTestId(`service-${s.serviceId}`).check()
      await page.getByTestId(`template-${templateId}`).check()
      await page.getByTestId('impact-partial').check()

      // Titel und Text sind aus der Vorlage gefüllt, nichts fehlt mehr
      await expect(page.getByTestId('title')).toHaveValue(`Störung: ${s.name}`)
      await expect(page.getByTestId('body')).toHaveValue(`Betroffen: ${s.name} (${s.groupName}).`)
      await expect(page.getByTestId('missing')).toHaveCount(0)

      await page.getByTestId('preview-button').click()
      await expect(page.getByTestId('effects')).toContainText(s.name)
      await publish(page)
      await expect(page.getByTestId('done')).toBeVisible({ timeout: 60000 })

      const list = await (await request.get(`/api/incidents?where[title][contains]=${s.id}&depth=0`)).json()
      expect(list.docs).toHaveLength(1)
      expect(list.docs[0]).toMatchObject({ title: `Störung: ${s.name}`, status: 'investigating', impact: 'partial' })
      expect((await getService(s.serviceId)).status).toBe('partial')
    } finally {
      await removeByTitle(request, 'incidents', s.id)
    }
  })

  test('Assistent „Wartung mit Vorlage“: erst Zeitraum, dann Vorlage, Veröffentlichen legt die Wartung an', async ({ page, request }) => {
    const s = await newService('Wartung')
    const templateId = await createTemplate(request, {
      name: `Vorlage Angekündigt ${s.id}`,
      kind: 'maintenance',
      status: 'upcoming',
      title: 'Wartung: {{services}}',
      body: 'Wartung an {{services}}.',
    })
    const localTime = (days: number) => new Date(Date.now() + days * DAY).toISOString().slice(0, 16)

    try {
      await page.goto('/admin/incident-from-template?kind=maintenance')
      await waitForHydration(page.getByTestId('group'))
      await page.getByTestId('group').selectOption(String(s.groupId))
      await page.getByTestId(`service-${s.serviceId}`).check()
      await page.getByTestId('maintenance-kind').selectOption('additional')
      await page.getByTestId('start').fill(localTime(2))
      await page.getByTestId('end').fill(localTime(3))
      await page.getByTestId(`template-${templateId}`).check()

      await expect(page.getByTestId('title')).toHaveValue(`Wartung: ${s.name}`)
      await expect(page.getByTestId('missing')).toHaveCount(0)

      await page.getByTestId('preview-button').click()
      await expect(page.getByTestId('preview')).toBeVisible()
      await publish(page)
      await expect(page.getByTestId('done')).toBeVisible({ timeout: 60000 })

      const list = await (await request.get(`/api/maintenances?where[title][contains]=${s.id}&depth=0`)).json()
      expect(list.docs).toHaveLength(1)
      expect(list.docs[0]).toMatchObject({ title: `Wartung: ${s.name}`, status: 'upcoming', maintenanceKind: 'additional' })
    } finally {
      await removeByTitle(request, 'maintenances', s.id)
    }
  })

  test('Vorlagen-Auswahl: zeigt Vorlagen zum Status, füllt Nachricht, SMS und ntfy und gibt sie beim Speichern weiter', async ({ page, request }) => {
    const s = await newService('Auswahl')
    await createTemplate(request, {
      name: `Vorlage Untersucht ${s.id}`,
      kind: 'incident',
      status: 'investigating',
      title: 'Untersucht: {{services}}',
      body: 'Wir untersuchen die Störung an {{services}}.',
    })
    const templateId = await createTemplate(request, {
      name: `Vorlage Behoben ${s.id}`,
      kind: 'incident',
      status: 'resolved',
      title: 'Behoben: {{services}}',
      body: 'Störung an {{services}} ({{group}}) behoben. Auswirkung war: {{impact}}.',
      smsBody: 'SMS {{services}}',
      ntfyBody: 'ntfy {{services}}',
    })
    const response = await request.post('/api/incidents', {
      data: { title: `Auswahl Störung ${s.id}`, impact: 'partial', affectedServices: [s.serviceId], updates: [{ status: 'investigating', message: 'Text' }] },
    })
    expect(response.status()).toBe(201)
    const incident = (await response.json()).doc.id as number

    try {
      // Die Auswahl lädt die Dienste des Vorfalls getrennt von den Vorlagen. Erst danach füllt sie `{{services}}` und `{{group}}`.
      const servicesLoaded = page.waitForResponse((r) => decodeURIComponent(r.url()).includes('/api/services?where[id][in]'))
      await page.goto(`/admin/collections/incidents/${incident}`)
      // Die gespeicherte Aktualisierung bekommt keine Auswahl
      await expect(page.locator('#field-updates__0__message')).toHaveValue('Text')
      await expect(page.getByTestId('update-template')).toHaveCount(0)

      await page.getByRole('button', { name: 'Add Update' }).click()
      const select = page.getByTestId('update-template-select')
      // Eine neue Zeile hat keinen Status, dann gibt es keine Vorlage. Der Status filtert in beide Richtungen.
      await expect(select.locator('option')).toHaveCount(1)
      const setStatus = async (label: string) => {
        await page.locator('#field-updates__1__status').click()
        await page.keyboard.type(label)
        await page.keyboard.press('Enter')
      }
      await setStatus('Investigating')
      await expect(select.locator('option', { hasText: `Vorlage Untersucht ${s.id}` })).toHaveCount(1)
      await expect(select.locator('option', { hasText: `Vorlage Behoben ${s.id}` })).toHaveCount(0)
      await setStatus('Resolved')
      await expect(select.locator('option', { hasText: `Vorlage Behoben ${s.id}` })).toHaveCount(1)
      await expect(select.locator('option', { hasText: `Vorlage Untersucht ${s.id}` })).toHaveCount(0)
      await servicesLoaded

      await select.selectOption(String(templateId))
      await expect(page.locator('#field-updates__1__message')).toHaveValue(`Störung an ${s.name} (${s.groupName}) behoben. Auswirkung war: Partial Outage.`)
      await expect(page.locator('#field-updates__1__smsBody')).toHaveValue(`SMS ${s.name}`)
      await expect(page.locator('#field-updates__1__ntfyBody')).toHaveValue(`ntfy ${s.name}`)
      await expect(page.getByTestId('update-template-carried')).toBeVisible()

      // Mit Speichern enden (Dokumentsperre, siehe Kopf der Datei). Der Status „Behoben“ schließt die Störung: Eine offene Störung,
      // die sich wegen der Sperre nicht löschen lässt, stünde sonst auf der Statusseite und stört andere Tests.
      await page.locator('#action-save').click()
      await expect
        .poll(async () => ((await (await request.get(`/api/incidents/${incident}?depth=0`)).json()).updates ?? []).length)
        .toBe(2)
      const saved = (await (await request.get(`/api/incidents/${incident}?depth=0`)).json()).updates[1]
      expect(saved).toMatchObject({ status: 'resolved', smsBody: `SMS ${s.name}`, ntfyBody: `ntfy ${s.name}` })
    } finally {
      await removeByTitle(request, 'incidents', s.id)
    }
  })
})
