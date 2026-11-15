import { test, expect } from '@playwright/test'
import { updateSettings } from '../utils/payload-helpers'

/**
 * Sprache in den Website-Einstellungen (Fork-Issue #94, Schritt 3 von #60).
 * Die Testumgebung startet mit DEFAULT_LANGUAGE=en. Die Tests setzen Sprache und Anzeige nach dem Lauf zurück.
 * Die Überschrift „Vergangene Störungen“ / „Past Incidents“ steht auf der Startseite in jeder Anzeige.
 */
const PAST_DE = 'Vergangene Störungen'
const PAST_EN = 'Past Incidents'

test.describe('Sprache der Einstellung', () => {
  test.describe.configure({ mode: 'serial' })

  test.afterAll(async () => {
    await updateSettings({ language: '', lagebildVariant: 'off' })
  })

  test('Deutsch: Statusseite und Atom-Feed', async ({ page, request }) => {
    await updateSettings({ language: 'de' })
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await expect(page.getByRole('heading', { name: PAST_DE })).toBeVisible()

    const atom = await request.get('/feed.atom')
    expect(atom.ok()).toBeTruthy()
    expect(await atom.text()).toContain('xml:lang="de"')
  })

  test('Englisch: Statusseite und Atom-Feed', async ({ page, request }) => {
    await updateSettings({ language: 'en' })
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('heading', { name: PAST_EN })).toBeVisible()

    const atom = await request.get('/feed.atom')
    expect(await atom.text()).toContain('xml:lang="en"')
  })

  test('Umstellung gilt bei der nächsten Anfrage, auch mit Lagebild', async ({ page }) => {
    await updateSettings({ language: 'de', lagebildVariant: 'a' })
    await page.goto('/')
    // Die Überschrift steht zweimal auf der Seite (Box und Abschnitt), die Box genügt.
    const box = page.getByTestId('box-incidents')
    await expect(box.getByRole('heading', { name: 'Aktuelle Störungen' })).toBeVisible()
    await updateSettings({ language: 'en' })
    await page.reload()
    await expect(box.getByRole('heading', { name: 'Current incidents' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Aktuelle Störungen' })).toHaveCount(0)
  })

  test('leere Sprache: es gilt DEFAULT_LANGUAGE (en)', async ({ page }) => {
    await updateSettings({ language: '' })
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('heading', { name: PAST_EN })).toBeVisible()
  })

  test('eine nicht geladene Sprache lässt sich nicht speichern', async ({ request }) => {
    const response = await request.post('/api/globals/settings', { data: { language: 'zz' } })
    expect(response.ok()).toBeFalsy()
  })
})
