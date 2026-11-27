import { test, expect, type Page } from '@playwright/test'
import { updateSettings } from '../utils/payload-helpers'

/**
 * Automatisches Neuladen (#288): Zeile „Stand … · aktualisiert sich …“ in der Fußzeile, Zeitgeber, Pausen.
 * Die Pausen laufen mit der Uhr des Browsers (`page.clock`), nur der Test des neuen Stands wartet echte 70 Sekunden:
 * Der Zwischenspeicher im Server läuft nach der Uhr des Servers ab.
 */
test.describe('Automatisches Neuladen', { tag: ['@public', '@statusseite', '@lagebild'] }, () => {
  test.describe.configure({ mode: 'serial' })

  test.afterAll(async () => {
    await updateSettings({ autoRefreshMinutes: 'off', lagebildVariant: 'off', lagebildCacheMinutes: '1' })
  })

  const line = (page: Page) => page.getByTestId('auto-refresh')

  /** Zählt die Anfragen, mit denen `router.refresh()` die Seite neu holt (RSC-Anfrage an die Seite selbst). */
  const countRefreshes = (page: Page) => {
    const state = { count: 0 }
    page.on('request', (request) => {
      if (request.headers()['rsc'] === '1' && new URL(request.url()).pathname === '/') state.count++
    })
    return state
  }

  test('ohne Einstellung steht keine Zeile in der Fußzeile', async ({ page }) => {
    await updateSettings({ autoRefreshMinutes: 'off' })
    await page.goto('/')
    await expect(page.getByRole('contentinfo')).toBeVisible()
    await expect(line(page)).toHaveCount(0)
  })

  test('die Zeile nennt den Stand und den Takt', async ({ page }) => {
    await updateSettings({ autoRefreshMinutes: '5' })
    await page.goto('/')
    await expect(line(page)).toHaveText(/^As of \d{2}:\d{2}.* · updates every 5 minutes$/)

    await updateSettings({ autoRefreshMinutes: '1' })
    await page.goto('/')
    await expect(line(page)).toHaveText(/updates every minute$/)
  })

  test('ein offenes Anmeldefenster pausiert das Neuladen, das Schließen holt es nach', async ({ page }) => {
    await updateSettings({ autoRefreshMinutes: '1' })
    await page.clock.install()
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const refreshes = countRefreshes(page)

    await page.getByRole('button', { name: /Subscribe/i }).click()
    await expect(page.getByRole('button', { name: 'Close dialog' })).toBeVisible()
    await page.clock.runFor('02:30')
    expect(refreshes.count, 'bei offenem Fenster kein Neuladen').toBe(0)

    await page.getByRole('button', { name: 'Close dialog' }).click()
    await page.clock.runFor('00:10')
    await expect.poll(() => refreshes.count).toBeGreaterThan(0)
  })

  test('ein Eingabefeld mit Fokus pausiert das Neuladen', async ({ page }) => {
    await updateSettings({ autoRefreshMinutes: '1' })
    await page.clock.install()
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const refreshes = countRefreshes(page)

    await page.evaluate(() => {
      const input = document.createElement('input')
      input.id = 'e2e-focus'
      document.body.appendChild(input)
      input.focus()
    })
    await page.clock.runFor('02:30')
    expect(refreshes.count, 'bei Fokus im Eingabefeld kein Neuladen').toBe(0)

    await page.evaluate(() => (document.getElementById('e2e-focus') as HTMLInputElement).blur())
    await page.clock.runFor('00:10')
    await expect.poll(() => refreshes.count).toBeGreaterThan(0)
  })

  test('ein unsichtbarer Tab pausiert, beim Sichtbarwerden lädt die Seite sofort neu', async ({ page }) => {
    await updateSettings({ autoRefreshMinutes: '1' })
    await page.clock.install()
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const refreshes = countRefreshes(page)

    const setHidden = (hidden: boolean) =>
      page.evaluate((value) => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => value })
        document.dispatchEvent(new Event('visibilitychange'))
      }, hidden)

    await setHidden(true)
    await page.clock.runFor('02:30')
    expect(refreshes.count, 'bei unsichtbarem Tab kein Neuladen').toBe(0)

    await setHidden(false)
    await expect.poll(() => refreshes.count).toBeGreaterThan(0)
  })

  test('das Intervall ist die Dauer des Zwischenspeichers: nach einer Minute zeigt die Seite einen neuen Stand', async ({ page }) => {
    test.setTimeout(180_000)
    // Das Feld „Zwischenspeicher des Lagebilds“ ist dann ohne Wirkung: Auch bei 10 Minuten gilt 1 Minute
    await updateSettings({ autoRefreshMinutes: '1', lagebildVariant: 'b', lagebildCacheMinutes: '10' })
    await page.goto('/')
    const first = await line(page).innerText()
    // 60 s Zwischenspeicher, dazu bis 4 s Spielraum, dazu die Anfrage selbst
    await expect(line(page)).not.toHaveText(first, { timeout: 90_000 })
  })
})
