import { test, expect, type Locator } from '@playwright/test'
import {
  clearCollection,
  createIncident,
  createMaintenance,
  createService,
  createServiceGroup,
  updateService,
  updateSettings,
} from '../utils/payload-helpers'

/**
 * Statusseite mit Boxen „Aktuelle Störungen“ und „Wartungen“.
 * Die Tests räumen Störungen und Wartungen vor jedem Test weg und setzen die Anzeige nach dem Lauf auf „off“ zurück.
 * Die Oberfläche läuft in den E2E-Tests auf Englisch, die Erwartungen erlauben beide Sprachen.
 *
 * Aufruf (nur mit einem Worker, sonst legen parallele Läufe die Zeile der globalen Einstellungen doppelt an):
 *   ./scripts/run-e2e-tests.sh tests/e2e/status-boxes.spec.ts --workers=1 --timeout=120000
 */

/**
 * Wartet, bis React ein Element hydriert hat. Vorher reagiert es nicht auf Maus, Fokus und Tippen, ein früher Test
 * scheitert dann zufällig. React hängt an hydrierte Elemente einen Schlüssel `__reactProps$…`; eine öffentliche
 * Markierung dafür gibt es nicht.
 */
async function waitForHydration(element: Locator): Promise<void> {
  await expect
    .poll(() => element.evaluate((node) => Object.keys(node).some((key) => key.startsWith('__reactProps'))), { timeout: 30_000 })
    .toBe(true)
}

const NO_INCIDENTS = /No current incidents|Keine aktuellen Störungen/
const MORE_ONE = /Show 1 more|1 weitere anzeigen/

const open = (title: string, affectedServices: number[] = []) =>
  createIncident({
    title,
    impact: 'partial',
    affectedServices,
    updates: [{ status: 'investigating', message: `Stand zu ${title}` }],
  })

test.describe('Statusseite mit Boxen', { tag: ['@public', '@statusseite'] }, () => {
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

  test('die Wartungsbox zählt alle geplanten Wartungen, nicht nur die ersten zehn der Liste darunter', async ({ page }) => {
    await updateSettings({ statusBoxEntries: 3 })
    const id = Date.now()
    // zwölf geplante Wartungen: Die Liste „Geplante Wartungen“ ist auf zehn begrenzt, die Box darf es nicht sein
    for (let i = 1; i <= 12; i++) {
      await createMaintenance({
        title: `Zähler ${id} Nr. ${i}`,
        scheduledStartAt: new Date(Date.now() + i * 3_600_000).toISOString(),
        scheduledEndAt: new Date(Date.now() + i * 3_600_000 + 1_800_000).toISOString(),
        autoStartOnSchedule: false,
        autoCompleteOnSchedule: false,
      })
    }

    await page.goto('/')
    const box = page.getByTestId('box-maintenances')
    await expect(box.getByTestId('box-item')).toHaveCount(3)
    // 12 geplant, 3 gezeigt: 9 weitere
    await expect(box.getByTestId('box-more')).toHaveText(/Show 9 more|9 weitere anzeigen/)
    // der Kopf nennt 12 mit der Beschriftung für Screenreader
    await expect(box.locator('header > span')).toHaveText(/12$/)
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

  test('offene Störung älter als 5 Tage steht in „Aktuelle Störungen“ und nicht in „Vergangene Störungen“', async ({ page }) => {
    const title = `Alt offen ${Date.now()}`
    const zehnTage = new Date(Date.now() - 10 * 86_400_000).toISOString()
    await createIncident({
      title,
      impact: 'partial',
      createdAt: zehnTage,
      updates: [{ status: 'investigating', message: 'Läuft seit Tagen', createdAt: zehnTage }],
    })

    await page.goto('/')
    await expect(page.locator('#incidents').getByText(title, { exact: true })).toBeVisible()
    await expect(page.locator('#past-incidents').getByText(title, { exact: true })).toHaveCount(0)
    await expect(page.getByTestId('box-incidents').getByText(title, { exact: true })).toBeVisible()
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
test.describe('Tooltip an der Gruppe', { tag: ['@public', '@statusseite'] }, () => {
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
  const load = async (page: import('@playwright/test').Page) => {
    await page.goto('/')
    await waitForHydration(button(page))
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

  test('nach einem Klick bleibt der Tooltip bei kleiner Mausbewegung geschlossen, bis die Maus die Kachel verlassen hat', async ({ page }) => {
    await load(page)
    await hover(page)
    await expect(tip(page)).toBeVisible()
    await button(page).click()
    await expect(panel(page)).toBeVisible()
    await expect(tip(page)).toBeHidden()
    // kleine Bewegung über derselben Kachel öffnet ihn nicht erneut
    const box = await button(page).boundingBox()
    expect(box).not.toBeNull()
    await page.mouse.move(box!.x + box!.width / 2 + 3, box!.y + box!.height / 2 + 2, { steps: 3 })
    await page.waitForTimeout(400)
    await expect(tip(page)).toBeHidden()
    // nach dem Verlassen der Kachel öffnet er wieder
    await page.mouse.move(2, 2)
    await page.waitForTimeout(400)
    await button(page).hover()
    await expect(tip(page)).toBeVisible()
  })

  test('Maus weg schließt den Tooltip nach höchstens 500 ms', async ({ page }) => {
    await load(page)
    await hover(page)
    await expect(tip(page)).toBeVisible()
    await page.mouse.move(2, 2)
    await expect(tip(page)).toBeHidden({ timeout: 700 })
  })

  test('Esc schließt auch einen Tooltip, der nur per Maus geöffnet wurde', async ({ page }) => {
    await load(page)
    await hover(page)
    await expect(tip(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(tip(page)).toBeHidden()
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

/**
 * Kachel „Alle“: Vorauswahl je Variante, Zeile wählt die Gruppe, die Adresse bleibt für „Alle“ ohne `gruppe`.
 */
test.describe('Kachel „Alle“', { tag: ['@public', '@statusseite'] }, () => {
  test.describe.configure({ mode: 'serial' })

  let groupId: number
  let groupName: string

  test.beforeAll(async () => {
    const id = Date.now()
    groupName = `Alle Gruppe ${id}`
    const group = await createServiceGroup({ name: groupName, icon: 'Server' })
    groupId = group.id
    const service = await createService({ name: `Alle Dienst ${id}`, group: group.id })
    await updateService(service.id, { status: 'degraded' })
  })

  test.afterAll(async () => {
    await updateSettings({ lagebildVariant: 'off' })
  })

  const allTile = (page: import('@playwright/test').Page) => page.getByTestId('lagebild-tile-all')
  const allButton = (page: import('@playwright/test').Page) => allTile(page).getByRole('button')
  const load = async (page: import('@playwright/test').Page) => {
    await page.goto('/')
    await waitForHydration(allButton(page))
  }

  test('Variante A: „Alle“ ist vorgewählt, Variante B: nichts', async ({ page }) => {
    await updateSettings({ lagebildVariant: 'a' })
    await load(page)
    await expect(allButton(page)).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByTestId('lagebild-panel-all')).toBeVisible()

    await updateSettings({ lagebildVariant: 'b' })
    await load(page)
    await expect(allButton(page)).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('lagebild-panel-all')).toHaveCount(0)
  })

  test('Kachel „Alle“ trägt ein Symbol statt des Wortes', async ({ page }) => {
    await updateSettings({ lagebildVariant: 'a' })
    await load(page)
    await expect(page.getByTestId('lagebild-tile-all').locator('svg').first()).toBeVisible()
  })

  test('Zeile wählt die Gruppe, „Alle“ nimmt `gruppe` wieder aus der Adresse', async ({ page }) => {
    await updateSettings({ lagebildVariant: 'a' })
    await load(page)
    await page.getByTestId('lagebild-panel-all').getByRole('button', { name: new RegExp(groupName) }).click()
    await expect(page.getByTestId(`lagebild-panel-${groupId}`)).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`gruppe=${groupId}`))

    await allButton(page).click()
    await expect(page.getByTestId('lagebild-panel-all')).toBeVisible()
    await expect(page).not.toHaveURL(/gruppe=/)
  })

  // „Alle“ steht in eigener Zeile über dem Raster (Issue #235), in beiden Darstellungen, hell und dunkel, breit und schmal
  for (const variant of ['a', 'b'] as const) {
    for (const [width, scheme] of [
      [1280, 'light'],
      [375, 'dark'],
    ] as const) {
      test(`Variante ${variant}, ${width} Pixel, ${scheme}: „Alle“ steht über dem Raster und der Gruppenüberschrift`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.emulateMedia({ colorScheme: scheme })
        await updateSettings({ lagebildVariant: variant })
        await load(page)
        const view = page.getByTestId(`lagebild-${variant}`)
        const grid = view.locator('[data-lagebild-grid]')
        const heading = view.getByRole('heading', { name: /^(Gruppen|Groups)$/ })
        await expect(grid.getByTestId('lagebild-tile-all')).toHaveCount(0)
        await expect(grid.getByTestId(`lagebild-tile-${groupId}`)).toBeVisible()

        const tile = (await allTile(page).boundingBox())!
        const line = (await heading.boundingBox())!
        const first = (await grid.boundingBox())!
        expect(tile.y + tile.height).toBeLessThanOrEqual(line.y)
        expect(line.y + line.height).toBeLessThanOrEqual(first.y)
        // volle Breite: die Zeile reicht so weit wie das Raster
        expect(tile.width).toBeGreaterThanOrEqual(first.width - 1)

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        expect(overflow).toBeLessThanOrEqual(0)
      })
    }
  }

  // Die Kachel „Alle“ liegt außerhalb des Rasters: Ihr Tooltip bleibt trotzdem im Fenster (Review zu #235)
  for (const width of [320, 360]) {
    test(`${width} Pixel: der Tooltip von „Alle“ bleibt im Fenster und verbreitert die Seite nicht`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await updateSettings({ lagebildVariant: 'b' })
      await load(page)
      // Bei langer Seite hydriert React noch, wenn der Knopf schon `__reactProps` trägt: Die einzelne Mausbewegung von
      // `hover()` geht dann verloren (Bewegungsereignisse werden nicht nachgeholt). Bewegung wiederholen.
      const tip = allTile(page).getByRole('tooltip')
      await expect(async () => {
        await allButton(page).evaluate((element) => element.scrollIntoView({ block: 'center' }))
        await page.mouse.move(1, 1)
        await allButton(page).hover()
        await expect(tip).toBeVisible({ timeout: 1_000 })
      }).toPass({ timeout: 30_000 })
      const box = (await tip.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
      // Unter 360 Pixel sind die Balken (mindestens 2 Pixel je Strich) schon ohne Tooltip breiter als das Fenster
      if (width >= 360) {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        expect(overflow).toBeLessThanOrEqual(0)
      }
    })
  }

  test('Variante A: der Bereich von „Alle“ steht direkt unter der Zeile, vor der Überschrift „Gruppen“', async ({ page }) => {
    await updateSettings({ lagebildVariant: 'a' })
    await load(page)
    const view = page.getByTestId('lagebild-a')
    const panel = page.getByTestId('lagebild-panel-all')
    await expect(panel).toBeVisible()
    const tile = (await allTile(page).boundingBox())!
    const area = (await panel.boundingBox())!
    const line = (await view.getByRole('heading', { name: /^(Gruppen|Groups)$/ }).boundingBox())!
    expect(area.y).toBeGreaterThanOrEqual(tile.y + tile.height)
    expect(area.y + area.height).toBeLessThanOrEqual(line.y)
    await expect(view.locator('[data-lagebild-grid]').getByTestId('lagebild-panel-all')).toHaveCount(0)
  })

  for (const width of [375, 700, 1280]) {
    test(`Variante A, ${width} Pixel: der Bereich einer Gruppe steht im Raster unter der Zeile der Gruppe`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await updateSettings({ lagebildVariant: 'a' })
      await load(page)
      const grid = page.getByTestId('lagebild-a').locator('[data-lagebild-grid]')
      const tile = grid.getByTestId(`lagebild-tile-${groupId}`)
      await tile.getByRole('button').click()
      const panel = page.getByTestId(`lagebild-panel-${groupId}`)
      await expect(panel).toBeVisible()
      // der Bereich steht im Raster, unter der gewählten Kachel, und „Alle“ bleibt zu
      await expect(grid.getByTestId(`lagebild-panel-${groupId}`)).toHaveCount(1)
      await expect(page.getByTestId('lagebild-panel-all')).toHaveCount(0)
      const box = (await tile.boundingBox())!
      const area = (await panel.boundingBox())!
      expect(area.y).toBeGreaterThanOrEqual(box.y + box.height)
    })
  }
})

/**
 * Schmale Fenster: Die geschlossenen Tooltips dürfen die Seite nicht verbreitern (Prüfliste G2, D1).
 */
test.describe('Seite ohne seitliches Scrollen', { tag: ['@public', '@statusseite'] }, () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Schmal Gruppe ${id}`, icon: 'Server' })
    await createService({ name: `Schmal Dienst ${id}`, group: group.id })
  })

  test.afterAll(async () => {
    await updateSettings({ lagebildVariant: 'off' })
  })

  // 320 Pixel: Der Balken hat 144 Striche, bei weniger als 288 Pixel Spaltenbreite hat er die Seite verbreitert (Issue #245)
  for (const variant of ['a', 'b'] as const) {
    for (const width of [320, 375, 768]) {
      test(`bei ${width} Pixel Breite ist die Seite nicht breiter als das Fenster (Variante ${variant.toUpperCase()})`, async ({ page }) => {
        await updateSettings({ lagebildVariant: variant })
        await page.setViewportSize({ width, height: 900 })
        await page.goto('/')
        await expect(page.getByTestId(`lagebild-${variant}`)).toBeVisible()
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        expect(overflow).toBeLessThanOrEqual(0)
      })
    }
  }
})
