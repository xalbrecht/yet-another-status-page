import { test, expect } from '@playwright/test'
import { updateSettings } from '../utils/payload-helpers'

/**
 * Gesamtzielwert der Verfügbarkeit (Konzept 4.4): Standard 99, im Admin änderbar.
 * Die Tests ändern die globalen Einstellungen und setzen den Wert danach zurück.
 */
test.describe('Zielwert der Verfügbarkeit', () => {
  test.describe.configure({ mode: 'serial' })

  test.afterAll(async () => {
    await updateSettings({ availabilityTarget: 99 })
  })

  test('Standardwert ist 99 Prozent', async ({ request }) => {
    await updateSettings({ availabilityTarget: 99 })
    const response = await request.get('/api/globals/settings')
    expect(response.ok()).toBe(true)
    expect((await response.json()).availabilityTarget).toBe(99)
  })

  test('geänderter Wert wird gespeichert', async ({ request }) => {
    await updateSettings({ availabilityTarget: 99.5 })
    const response = await request.get('/api/globals/settings')
    expect((await response.json()).availabilityTarget).toBe(99.5)
  })

  test('Wert über 100 wird abgelehnt', async ({ request }) => {
    const response = await request.post('/api/globals/settings', { data: { availabilityTarget: 101 } })
    expect(response.ok()).toBe(false)
  })
})
