import { test, expect } from '@playwright/test'

/**
 * Zugriffsschutz der beiden Routen, die das Statusprotokoll ändern. Läuft nur gegen einen Server mit
 * PAYLOAD_PUBLIC_ALLOW_WRITES=false (E2E_ACCESS_LOCKED=1), sonst sind die Routen im Testmodus offen.
 */
for (const route of ['rebuild', 'convert-maintenance']) {
  test(`POST /api/status-log/${route}: anonyme Anfrage wird mit Status 401 abgewiesen und ändert nichts`, { tag: ['@admin', '@statusprotokoll'] }, async ({ request }) => {
    test.skip(process.env.E2E_ACCESS_LOCKED !== '1', 'Server läuft mit offenen Schreibrechten')
    const before = (await (await request.get('/api/service-status-events?limit=1')).json()).totalDocs
    const response = await request.post(`/api/status-log/${route}`, { data: { dryRun: false, expect: { count: 0, fingerprint: 'x' } } })
    expect(response.status()).toBe(401)
    const after = (await (await request.get('/api/service-status-events?limit=1')).json()).totalDocs
    expect(after).toBe(before)
  })
}
