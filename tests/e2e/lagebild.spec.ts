import { test, expect } from '@playwright/test'
import {
  createIncident,
  createService,
  createServiceGroup,
  getService,
  updateIncident,
  updateService,
  updateSettings,
} from '../utils/payload-helpers'

/**
 * Lagebild: Kacheln, Balken, 14-Tage-Übersicht und Zustand bei der Meldung.
 * Die Tests setzen die Anzeige nach jedem Lauf auf „off“ zurück.
 */
test.describe('Lagebild', () => {
  test.describe.configure({ mode: 'serial' })

  test.afterAll(async () => {
    await updateSettings({ lagebildVariant: 'off' })
  })

  test('ist standardmäßig ausgeblendet', async ({ page }) => {
    await updateSettings({ lagebildVariant: 'off' })
    await page.goto('/')
    await expect(page.getByTestId('lagebild-a')).toHaveCount(0)
    await expect(page.getByTestId('lagebild-b')).toHaveCount(0)
  })

  test('Zustandsänderung erscheint als Kachel, Balken und Eintrag der letzten 14 Tage', async ({ page }) => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Lagebild Mail ${id}`, icon: 'Mail' })
    const service = await createService({ name: `Lagebild Dienst ${id}`, group: group.id })
    await updateService(service.id, { status: 'partial' })
    await updateSettings({ lagebildVariant: 'both' })

    await page.goto('/')
    const variantA = page.getByTestId('lagebild-a')
    const variantB = page.getByTestId('lagebild-b')
    await expect(variantA).toBeVisible()
    await expect(variantB).toBeVisible()

    // Kachel mit Zustand, Balken und Eintrag in beiden Varianten
    for (const variant of [variantA, variantB]) {
      await expect(variant.getByRole('button', { name: new RegExp(`Lagebild Mail ${id}`) }).first()).toBeVisible()
      await expect(variant.getByText(new RegExp(`(Partial Outage|Teilausfall): Lagebild Mail ${id}`))).toBeVisible()
    }
    // Variante A zeigt zusätzlich die separate Balkenliste
    await expect(variantA.locator('[role="img"]').first()).toBeVisible()
  })

  test('Filter je Gruppe schränkt die Übersicht ein und steht in der Adresse', async ({ page }) => {
    const id = Date.now()
    const groupA = await createServiceGroup({ name: `Filter Alpha ${id}` })
    const groupB = await createServiceGroup({ name: `Filter Beta ${id}` })
    const serviceA = await createService({ name: `Alpha Dienst ${id}`, group: groupA.id })
    const serviceB = await createService({ name: `Beta Dienst ${id}`, group: groupB.id })
    await updateService(serviceA.id, { status: 'major' })
    await updateService(serviceB.id, { status: 'degraded' })
    await updateSettings({ lagebildVariant: 'a' })

    await page.goto('/')
    const view = page.getByTestId('lagebild-a')
    const entryA = view.getByText(new RegExp(`(Major Outage|Schwerer Ausfall): Filter Alpha ${id}`))
    const entryB = view.getByText(new RegExp(`(Degraded|Eingeschränkt): Filter Beta ${id}`))
    await expect(entryA).toBeVisible()
    await expect(entryB).toBeVisible()

    // Filter über die Schaltfläche
    await view.getByRole('group').getByRole('button', { name: `Filter Alpha ${id}` }).click()
    await expect(entryA).toBeVisible()
    await expect(entryB).toHaveCount(0)
    await expect(page).toHaveURL(new RegExp(`gruppe=${groupA.id}`))

    // Adresse mit Filter direkt öffnen
    await page.goto(`/?gruppe=${groupB.id}`)
    await expect(page.getByTestId('lagebild-a').getByText(new RegExp(`Filter Beta ${id}`)).first()).toBeVisible()
    await expect(page.getByTestId('lagebild-a').getByText(new RegExp(`(Major Outage|Schwerer Ausfall): Filter Alpha ${id}`))).toHaveCount(0)
  })

  test('Meldung setzt den Zustand der betroffenen Dienste und die Behebung setzt ihn zurück', async () => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Meldung Gruppe ${id}` })
    const service = await createService({ name: `Meldung Dienst ${id}`, group: group.id })

    const incident = await createIncident({
      title: `Meldung ${id}`,
      impact: 'major',
      affectedServices: [service.id],
      updates: [{ status: 'investigating', message: 'Wir prüfen.', createdAt: new Date(Date.now() - 60_000).toISOString() }],
    })
    expect((await getService(service.id)).status).toBe('major')

    await updateIncident(incident.id, {
      updates: [
        { status: 'investigating', message: 'Wir prüfen.', createdAt: new Date(Date.now() - 60_000).toISOString() },
        { status: 'resolved', message: 'Behoben.', createdAt: new Date().toISOString() },
      ],
    })
    expect((await getService(service.id)).status).toBe('operational')
  })

  test('der schlechteste offene Zustand gewinnt, wenn zwei Störungen denselben Dienst betreffen', async () => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Zwei Meldungen ${id}` })
    const service = await createService({ name: `Zwei Dienst ${id}`, group: group.id })
    const update = [{ status: 'investigating' as const, message: 'Wir prüfen.' }]

    const minor = await createIncident({ title: `Klein ${id}`, impact: 'degraded', affectedServices: [service.id], updates: update })
    const major = await createIncident({ title: `Groß ${id}`, impact: 'major', affectedServices: [service.id], updates: update })
    expect((await getService(service.id)).status).toBe('major')

    // Große Störung behoben: die kleine bleibt offen
    await updateIncident(major.id, {
      updates: [...update.map((u) => ({ ...u, createdAt: new Date(Date.now() - 60_000).toISOString() })), { status: 'resolved', message: 'Behoben.', createdAt: new Date().toISOString() }],
    })
    expect((await getService(service.id)).status).toBe('degraded')

    await updateIncident(minor.id, {
      updates: [...update.map((u) => ({ ...u, createdAt: new Date(Date.now() - 60_000).toISOString() })), { status: 'resolved', message: 'Behoben.', createdAt: new Date().toISOString() }],
    })
    expect((await getService(service.id)).status).toBe('operational')
  })
})
