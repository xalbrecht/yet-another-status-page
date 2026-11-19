import { test, expect } from '@playwright/test'

/**
 * Angaben zum laufenden Stand über die JSON-Route. Die Admin-Seite selbst wird in der E2E-Umgebung nicht getestet.
 * Die Testumgebung baut ohne Build-Argumente, deshalb gilt sie als „kein YASP-Image“.
 */
test.describe('Systemangaben (Route)', { tag: ['@admin', '@system'] }, () => {
  test('liefert Version, Node, Startzeit, Container und die letzte Migration', async ({ request }) => {
    const response = await request.get('/api/system-info')
    expect(response.status()).toBe(200)
    const info = await response.json()
    expect(info.image).toBeNull()
    expect(info.version).toMatch(/^\d+\.\d+\.\d+/)
    expect(info.node).toMatch(/^v\d+\./)
    const startedAt = new Date(info.startedAt).getTime()
    expect(startedAt).toBeGreaterThan(0)
    expect(startedAt).toBeLessThanOrEqual(Date.now())
    expect(typeof info.container).toBe('boolean')
    // Die Testumgebung legt das Schema im Entwicklungsmodus an (Zeile „dev“, keine Migration): dann ist der Wert leer, sonst ein Name mit Zeitstempel
    expect(info.lastMigration === null || /^\d{8}_\d{6}/.test(info.lastMigration)).toBe(true)
    expect(info.dateTime.timezone).toBeTruthy()
    expect(info.dateTime.locale).toBeTruthy()
  })
})
