import { test, expect } from '@playwright/test'
import {
  clearCollection,
  createIncident,
  createService,
  createServiceGroup,
  updateService,
  updateSettings,
} from '../utils/payload-helpers'

/**
 * Statusseite mit Boxen „Aktuelle Störungen“ und „Wartungen“ (Fork-Issue #73).
 * Die Tests räumen Störungen und Wartungen vor jedem Test weg und setzen die Anzeige nach dem Lauf auf „off“ zurück.
 * Die Oberfläche läuft in den E2E-Tests auf Englisch, die Erwartungen erlauben beide Sprachen.
 */
const NO_INCIDENTS = /No current incidents|Keine aktuellen Störungen/
const MORE_ONE = /Show 1 more|1 weitere anzeigen/

const open = (title: string, affectedServices: number[] = []) =>
  createIncident({
    title,
    impact: 'partial',
    affectedServices,
    updates: [{ status: 'investigating', message: `Stand zu ${title}` }],
  })

test.describe('Statusseite mit Boxen', () => {
  test.describe.configure({ mode: 'serial' })

  let serviceId: number
  let serviceName: string

  test.beforeAll(async () => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Boxen Gruppe ${id}`, icon: 'Server' })
    serviceName = `Boxen Dienst ${id}`
    serviceId = (await createService({ name: serviceName, group: group.id })).id
  })

  test.beforeEach(async () => {
    await clearCollection('incidents')
    await clearCollection('maintenances')
    await updateSettings({
      lagebildVariant: 'a',
      statusBoxEntries: 3,
      statusBoxContent: 'full',
      statusBoxesPlacement: 'before',
    })
  })

  test.afterAll(async () => {
    await updateSettings({
      lagebildVariant: 'off',
      statusBoxEntries: 3,
      statusBoxContent: 'full',
      statusBoxesPlacement: 'before',
    })
  })

  test('Variante off: Liste der Dienste wie bisher, kein Boxen-Layout, offene Störung im Tageslisting', async ({ page }) => {
    await updateSettings({ lagebildVariant: 'off' })
    const title = `Off Störung ${Date.now()}`
    await open(title)

    await page.goto('/')
    await expect(page.getByTestId('status-layout')).toHaveCount(0)
    await expect(page.getByTestId('service-row').first()).toBeVisible()
    await expect(page.getByText(title, { exact: true })).toBeVisible()
    await expect(page.locator('#incidents')).toHaveCount(0)
    await expect(page.getByTestId('box-incidents')).toHaveCount(0)
  })

  test('Variante a: Boxen statt Liste der Dienste', async ({ page }) => {
    await page.goto('/')
    const layout = page.getByTestId('status-layout')
    await expect(layout).toBeVisible()
    await expect(layout).toHaveAttribute('data-variant', 'a')
    await expect(page.getByTestId('service-row')).toHaveCount(0)
    await expect(page.getByTestId('box-incidents')).toBeVisible()
    await expect(page.getByTestId('box-maintenances')).toBeVisible()
  })

  test('offene Störung steht in der Box, gelöste nicht', async ({ page }) => {
    const id = Date.now()
    await open(`Offen ${id}`)
    await createIncident({
      title: `Gelöst ${id}`,
      impact: 'partial',
      updates: [
        { status: 'investigating', message: 'Start', createdAt: new Date(Date.now() - 3_600_000).toISOString() },
        { status: 'resolved', message: 'Behoben' },
      ],
    })

    await page.goto('/')
    const box = page.getByTestId('box-incidents')
    await expect(box.getByText(`Offen ${id}`, { exact: true })).toBeVisible()
    await expect(box.getByText(`Gelöst ${id}`, { exact: true })).toHaveCount(0)
  })

  test('statusBoxEntries 1 bei zwei offenen Störungen: ein Eintrag und „1 weitere“', async ({ page }) => {
    await updateSettings({ statusBoxEntries: 1 })
    const id = Date.now()
    await open(`Eins ${id}`)
    await open(`Zwei ${id}`)

    await page.goto('/')
    const box = page.getByTestId('box-incidents')
    await expect(box.getByTestId('box-item')).toHaveCount(1)
    await expect(box.getByTestId('box-more')).toHaveText(MORE_ONE)
    await expect(box.getByTestId('box-more')).toHaveAttribute('href', '#incidents')
  })

  test('statusBoxContent compact lässt die Dienste im Eintrag weg, full zeigt sie', async ({ page }) => {
    await open(`Inhalt ${Date.now()}`, [serviceId])

    await page.goto('/')
    await expect(page.getByTestId('box-incidents').getByTestId('box-service')).toHaveText(serviceName)

    await updateSettings({ statusBoxContent: 'compact' })
    await page.goto('/')
    await expect(page.getByTestId('box-incidents').getByTestId('box-item')).toHaveCount(1)
    await expect(page.getByTestId('box-incidents').getByTestId('box-service')).toHaveCount(0)
  })

  test('statusBoxesPlacement after steht im Raster', async ({ page }) => {
    await updateSettings({ statusBoxesPlacement: 'after' })
    await page.goto('/')
    await expect(page.getByTestId('status-layout')).toHaveAttribute('data-placement', 'after')
  })

  test('ohne Störungen steht der Satz in der Box und im Block „Aktuelle Störungen“', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('box-incidents').getByText(NO_INCIDENTS)).toBeVisible()
    await expect(page.getByTestId('box-incidents').getByTestId('box-item')).toHaveCount(0)
    await expect(page.locator('#incidents').getByText(NO_INCIDENTS)).toBeVisible()
  })

  test('Block „Aktuelle Störungen“ nur offen, Block „Vergangene Störungen“ nur gelöst', async ({ page }) => {
    const id = Date.now()
    await open(`Läuft ${id}`)
    await createIncident({
      title: `Vorbei ${id}`,
      impact: 'partial',
      updates: [
        { status: 'investigating', message: 'Start', createdAt: new Date(Date.now() - 3_600_000).toISOString() },
        { status: 'resolved', message: 'Behoben' },
      ],
    })

    await page.goto('/')
    const current = page.locator('#incidents')
    const past = page.locator('#past-incidents')
    await expect(current.getByText(`Läuft ${id}`, { exact: true })).toBeVisible()
    await expect(current.getByText(`Vorbei ${id}`, { exact: true })).toHaveCount(0)
    await expect(past.getByText(`Vorbei ${id}`, { exact: true })).toBeVisible()
    await expect(past.getByText(`Läuft ${id}`, { exact: true })).toHaveCount(0)
  })

  test('vier offene Störungen: die Box zeigt drei, der Block alle vier', async ({ page }) => {
    const id = Date.now()
    for (const n of [1, 2, 3, 4]) await open(`Vier ${n} ${id}`)

    await page.goto('/')
    await expect(page.getByTestId('box-incidents').getByTestId('box-item')).toHaveCount(3)
    await expect(page.locator('#incidents').getByRole('link', { name: new RegExp(`Vier . ${id}`) })).toHaveCount(4)
  })
})

/**
 * Tooltip an der Kachel einer Gruppe: Hover, Tastatur und Touch.
 * Die Gruppe hat zwei Dienste, einer davon im Zustand „partial“.
 */
test.describe('Tooltip an der Gruppe', () => {
  test.describe.configure({ mode: 'serial' })

  let groupId: number
  let groupName: string

  test.beforeAll(async () => {
    const id = Date.now()
    groupName = `Tooltip Gruppe ${id}`
    const group = await createServiceGroup({ name: groupName, icon: 'Server' })
    groupId = group.id
    await createService({ name: `Tooltip Dienst A ${id}`, group: group.id })
    const down = await createService({ name: `Tooltip Dienst B ${id}`, group: group.id })
    await updateService(down.id, { status: 'partial' })
    await updateSettings({ lagebildVariant: 'a' })
  })

  test.afterAll(async () => {
    await updateSettings({ lagebildVariant: 'off' })
  })

  const tile = (page: import('@playwright/test').Page) => page.getByTestId(`lagebild-tile-${groupId}`)
  const button = (page: import('@playwright/test').Page) => tile(page).getByRole('button')
  const tip = (page: import('@playwright/test').Page) => tile(page).locator('[role="tooltip"]')
  const panel = (page: import('@playwright/test').Page) => page.getByTestId(`lagebild-panel-${groupId}`)
  // Erst nach der Hydrierung reagiert die Kachel auf Maus, Fokus und Tippen (Hinweis in der Memory zur E2E-Umgebung)
  const load = async (page: import('@playwright/test').Page) => {
    await page.goto('/')
    await expect
      .poll(() => button(page).evaluate((element) => Object.keys(element).some((key) => key.startsWith('__reactProps'))), {
        timeout: 30_000,
      })
      .toBe(true)
  }
  // Mit vielen Gruppen liegt die Kachel weit unten. Der Tooltip steht unter ihr und muss im Fenster liegen.
  const hover = async (page: import('@playwright/test').Page) => {
    await tile(page).evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await button(page).hover()
  }

  test('Hover über die Kachel zeigt den Tooltip mit den Diensten', async ({ page }) => {
    await load(page)
    await hover(page)
    await expect(tip(page)).toBeVisible()
    await expect(tip(page).getByText(/Tooltip Dienst A/)).toBeVisible()
    await expect(tip(page).getByText(/Tooltip Dienst B/)).toBeVisible()
  })

  test('Maus in den Tooltip lässt ihn offen, Klick im Tooltip zeigt das Dienstfeld', async ({ page }) => {
    await load(page)
    await hover(page)
    const box = await tip(page).boundingBox()
    expect(box).not.toBeNull()
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2, { steps: 15 })
    await expect(tip(page)).toBeVisible()
    await page.waitForTimeout(400)
    await expect(tip(page)).toBeVisible()
    await tip(page).click()
    await expect(panel(page)).toBeVisible()
  })

  test('Maus weg schließt den Tooltip nach höchstens 500 ms', async ({ page }) => {
    await load(page)
    await hover(page)
    await expect(tip(page)).toBeVisible()
    await page.mouse.move(2, 2)
    await expect(tip(page)).toBeHidden({ timeout: 700 })
  })

  test('Tab fokussiert die Kachel und zeigt den Tooltip, Esc schließt ihn', async ({ page }) => {
    await load(page)
    await button(page).focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(button(page)).toBeFocused()
    await expect(tip(page)).toBeVisible()
    await expect(button(page)).toHaveAttribute('aria-describedby', /.+/)
    await page.keyboard.press('Escape')
    await expect(tip(page)).toBeHidden()
  })

  test.describe('Touch', () => {
    test.use({ hasTouch: true })

    test('erstes Tippen zeigt den Tooltip, zweites das Dienstfeld', async ({ page }) => {
      await load(page)
      await button(page).tap()
      await expect(tip(page)).toBeVisible()
      await expect(panel(page)).toHaveCount(0)
      await button(page).tap()
      await expect(panel(page)).toBeVisible()
    })
  })
})
