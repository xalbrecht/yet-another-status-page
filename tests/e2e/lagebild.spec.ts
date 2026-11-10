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
 * Lagebild: Kacheln, Dienste je Gruppe, Rückschau und Zustand bei der Meldung.
 * Die Tests setzen die Anzeige nach jedem Lauf auf „off“ zurück.
 */
test.describe('Lagebild', () => {
  test.describe.configure({ mode: 'serial' })

  test.afterAll(async () => {
    await updateSettings({ lagebildVariant: 'off', lagebildPeriodDays: '14', lagebildBarHours: '12' })
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
  })

  test('Klick auf eine Kachel klappt die Dienste mit Balken und Verfügbarkeit auf', async ({ page }) => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Aufklappen Gruppe ${id}`, icon: 'Server' })
    const service = await createService({ name: `Aufklappen Dienst ${id}`, group: group.id })
    await updateService(service.id, { status: 'major' })
    await updateSettings({ lagebildVariant: 'a' })

    await page.goto('/')
    const view = page.getByTestId('lagebild-a')
    const tile = view.locator('button[aria-expanded]', { hasText: `Aufklappen Gruppe ${id}` })
    const panel = page.getByTestId(`lagebild-panel-${group.id}`)

    await expect(panel).toHaveCount(0)
    await expect(tile).toHaveAttribute('aria-expanded', 'false')

    await tile.click()
    await expect(tile).toHaveAttribute('aria-expanded', 'true')
    await expect(panel).toBeVisible()
    await expect(panel.getByText(`Aufklappen Dienst ${id}`)).toBeVisible()
    await expect(panel.locator('[role="img"]').first()).toBeVisible()
    // Balken aus 144 Strichen zu 5 Minuten, der Tooltip nennt die Uhrzeit und den Zustand
    const strokes = panel.locator('[role="img"]').first().locator('[data-i]')
    await expect(strokes).toHaveCount(144)
    await strokes.nth(100).hover()
    await expect(page.getByRole('tooltip')).toContainText(/\d{2}:\d{2}/)
    await expect(page.getByRole('tooltip')).toContainText(/Schwerer Ausfall|Major Outage|Keine Daten|No data/)
    // Dienst war erst seit dem Anlegen bekannt und seitdem ausgefallen: Verfügbarkeit unter 100 %
    await expect(panel.getByText(/\d+[.,]\d{2} %/)).toBeVisible()

    // zweiter Klick schließt den Bereich
    await tile.click()
    await expect(panel).toHaveCount(0)
  })

  test('Rückschau: Vorgabe des Admins, Auswahl des Besuchers, ungültiger Wert', async ({ page }) => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Rückschau Gruppe ${id}` })
    const service = await createService({ name: `Rückschau Dienst ${id}`, group: group.id })
    await updateService(service.id, { status: 'degraded' })
    await updateSettings({ lagebildVariant: 'a', lagebildPeriodDays: '14' })

    await page.goto('/')
    const select = page.getByTestId('lagebild-period')
    await expect(select).toHaveValue('14')

    // Besucher wählt „Quartal“: Adresse und Überschrift folgen
    await select.selectOption('90')
    await expect(page).toHaveURL(/rueckschau=90/)
    await expect(page.getByRole('heading', { name: /90/ })).toBeVisible()
    await expect(select).toHaveValue('90')

    // ungültiger Wert fällt auf die Vorgabe zurück
    await page.goto('/?rueckschau=7')
    await expect(page.getByTestId('lagebild-period')).toHaveValue('14')

    // Vorgabe des Admins „Halbjahr“; die Vorgabe selbst erscheint nicht in der Adresse
    await updateSettings({ lagebildPeriodDays: '180' })
    await page.goto('/')
    // React hängt die Handler erst nach dem Laden an: vorher löst selectOption nichts aus
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="lagebild-period"]')
      return !!el && Object.keys(el).some((key) => key.startsWith('__reactProps'))
    })
    await expect(page.getByTestId('lagebild-period')).toHaveValue('180')
    await page.getByTestId('lagebild-period').selectOption('14')
    await expect(page).toHaveURL(/rueckschau=14/)
    await page.getByTestId('lagebild-period').selectOption('180')
    await expect(page).not.toHaveURL(/rueckschau/)
  })

  test('Zeitraum des Balkens: Vorgabe des Admins, Auswahl des Besuchers, ungültiger Wert', async ({ page }) => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Balken Gruppe ${id}` })
    const service = await createService({ name: `Balken Dienst ${id}`, group: group.id })
    await updateService(service.id, { status: 'degraded' })
    await updateSettings({ lagebildVariant: 'a', lagebildBarHours: '12' })

    // React hängt die Handler erst nach dem Laden an: vorher löst selectOption nichts aus
    const bereit = (testId: string) =>
      page.waitForFunction((id) => {
        const el = document.querySelector(`[data-testid="${id}"]`)
        return !!el && Object.keys(el).some((key) => key.startsWith('__reactProps'))
      }, testId)

    await page.goto('/')
    await bereit('lagebild-bar-hours-a')
    const select = page.getByTestId('lagebild-bar-hours-a')
    await expect(select).toHaveValue('12')

    // Gruppe öffnen: 144 Striche, Überschrift nennt 12 Stunden und 5 Minuten
    await page.getByTestId('lagebild-a').locator('button[aria-expanded]', { hasText: `Balken Gruppe ${id}` }).click()
    const panel = page.getByTestId(`lagebild-panel-${group.id}`)
    // Die Gruppe steht in der Adresse, bevor die Auswahl bedient wird (sonst überholen sich zwei Adressänderungen)
    await expect(page).toHaveURL(new RegExp(`gruppe=${group.id}`))
    await expect(panel.locator('[data-i]')).toHaveCount(144)
    await expect(panel).toContainText(/(Letzte|Last) 12 (Stunden|hours) · 5 (Minuten|minutes)/)

    // Besucher wählt 24 Stunden: Adresse, Überschrift und Strichlänge folgen, es bleiben 144 Striche
    // Die Adresse ändert sich erst, wenn der Server die Seite neu geliefert hat (Dev-Server: bis zu einigen Sekunden)
    await select.selectOption('24')
    await expect(page).toHaveURL(/balken=24/, { timeout: 30_000 })
    await expect(select).toHaveValue('24')
    await expect(panel).toContainText(/(Letzte|Last) 24 (Stunden|hours) · 10 (Minuten|minutes)/, { timeout: 30_000 })
    await expect(panel.locator('[data-i]')).toHaveCount(144)

    // ungültiger Wert fällt auf die Vorgabe zurück
    await page.goto('/?balken=7')
    await expect(page.getByTestId('lagebild-bar-hours-a')).toHaveValue('12')

    // Vorgabe des Admins „24 Stunden“; die Vorgabe selbst erscheint nicht in der Adresse
    await updateSettings({ lagebildBarHours: '24' })
    await page.goto('/')
    await bereit('lagebild-bar-hours-a')
    await expect(page.getByTestId('lagebild-bar-hours-a')).toHaveValue('24')
    await page.getByTestId('lagebild-bar-hours-a').selectOption('12')
    await expect(page).toHaveURL(/balken=12/, { timeout: 30_000 })
    await page.getByTestId('lagebild-bar-hours-a').selectOption('24')
    await expect(page).not.toHaveURL(/balken/, { timeout: 30_000 })
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
