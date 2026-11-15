import { test, expect } from '@playwright/test'
import { updateSettings } from '../utils/payload-helpers'

/**
 * Sprache in den Website-Einstellungen (Fork-Issue #94, Schritt 3 von #60).
 * Die Testumgebung startet mit DEFAULT_LANGUAGE=en. Die Tests setzen die Sprache nach dem Lauf zurück.
 * Seiten laufen mit einem Worker (Einstellungen sind global).
 */
test.describe('Sprache der Einstellung', () => {
  test.describe.configure({ mode: 'serial' })

  test.afterAll(async () => {
    await updateSettings({ language: '' })
  })

  test('Deutsch: Statusseite, lang-Attribut und Feeds', async ({ page, request }) => {
    await updateSettings({ language: 'de' })
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await expect(page.getByRole('heading', { name: 'Aktuelle Störungen' })).toBeVisible()

    const atom = await request.get('/feed.atom')
    expect(atom.ok()).toBeTruthy()
    expect(await atom.text()).toContain('Störungen')
  })

  test('Englisch: Statusseite und Feeds', async ({ page, request }) => {
    await updateSettings({ language: 'en' })
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('heading', { name: 'Current incidents' })).toBeVisible()

    const atom = await request.get('/feed.atom')
    expect(await atom.text()).not.toContain('Störungen')
  })

  test('Umstellung gilt bei der nächsten Anfrage, auch im Lagebild', async ({ page }) => {
    await updateSettings({ language: 'de' })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Aktuelle Störungen' })).toBeVisible()
    await updateSettings({ language: 'en' })
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Current incidents' })).toBeVisible()
  })

  test('leere Sprache: es gilt DEFAULT_LANGUAGE (en)', async ({ page }) => {
    await updateSettings({ language: '' })
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })

  test('eine nicht geladene Sprache lässt sich nicht speichern', async ({ request }) => {
    const response = await request.post('/api/globals/settings', { data: { language: 'zz' } })
    expect(response.ok()).toBeFalsy()
  })
})
