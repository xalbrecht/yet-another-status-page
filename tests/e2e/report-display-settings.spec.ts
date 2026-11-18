import { test, expect } from '@playwright/test'
import { updateSettings } from '../utils/payload-helpers'

/**
 * Einstellungen zur Darstellung beendeter Dienste im Gruppenblatt des Verfügbarkeitsberichts (Issue #182).
 * Die Admin-Seite selbst wird in der E2E-Umgebung nicht getestet: hier zählt, dass die Spalten der Migration
 * existieren, die Vorgaben stimmen und nur gültige Werte gespeichert werden.
 */
test.describe('Einstellungen: beendete Dienste im Bericht', () => {
  test.describe.configure({ mode: 'serial' })
  test.afterAll(async () => {
    await updateSettings({ reportHeatEndedStyle: 'label', reportSheetActiveStyle: 'marks' })
  })

  test('Vorgabe: Hinweis an der Zeile der Wärmekarte und zwei Felder in den Balken', async ({ request }) => {
    await updateSettings({ reportHeatEndedStyle: 'label', reportSheetActiveStyle: 'marks' })
    const settings = await (await request.get('/api/globals/settings')).json()
    expect(settings.reportHeatEndedStyle).toBe('label')
    expect(settings.reportSheetActiveStyle).toBe('marks')
  })

  test('beide Einstellungen lassen sich unabhängig ändern', async ({ request }) => {
    await updateSettings({ reportHeatEndedStyle: 'hatch' })
    let settings = await (await request.get('/api/globals/settings')).json()
    expect(settings.reportHeatEndedStyle).toBe('hatch')
    expect(settings.reportSheetActiveStyle).toBe('marks')

    await updateSettings({ reportSheetActiveStyle: 'hints' })
    settings = await (await request.get('/api/globals/settings')).json()
    expect(settings.reportHeatEndedStyle).toBe('hatch')
    expect(settings.reportSheetActiveStyle).toBe('hints')
  })

  test('ein unbekannter Wert wird abgelehnt', async ({ request }) => {
    expect((await request.post('/api/globals/settings', { data: { reportHeatEndedStyle: 'bunt' } })).ok()).toBe(false)
    expect((await request.post('/api/globals/settings', { data: { reportSheetActiveStyle: 'bunt' } })).ok()).toBe(false)
  })
})
