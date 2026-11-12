import { test, expect, type APIRequestContext } from '@playwright/test'
import { unzipSync } from 'fflate'
import { createService, createServiceGroup } from '../utils/payload-helpers'

/**
 * Export des Verfügbarkeitsberichts über die Route `/api/availability-report/export` (ZIP, PDF, Excel).
 * Die ZIP-Datei über alle Gruppen rendert jede Gruppe, daher gilt ein großzügiges Zeitlimit.
 */
test.setTimeout(240_000)
const currentMonth = () => new Date().toISOString().slice(0, 7)

const exportOf = (request: APIRequestContext, query: string) => request.get(`/api/availability-report/export?${query}`, { timeout: 200_000 })
const startsWith = (body: Buffer, text: string) => body.subarray(0, text.length).toString('latin1') === text

async function groupWithServices() {
  const id = Date.now()
  const group = await createServiceGroup({ name: `Export ${id}`, icon: 'Server' })
  await createService({ name: `Export Dienst A ${id}`, group: group.id })
  await createService({ name: `Export Dienst B ${id}`, group: group.id })
  return { id, group }
}

test.describe('Verfügbarkeitsbericht (Export)', () => {
  test('format=xlsx liefert eine Excel-Datei', async ({ request }) => {
    const response = await exportOf(request, `format=xlsx&period=${currentMonth()}`)
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('spreadsheetml')
    expect(response.headers()['content-disposition']).toMatch(/attachment; filename="verfuegbarkeitsbericht-[\d-]+\.xlsx"/)
    expect(startsWith(await response.body(), 'PK')).toBe(true)
  })

  test('format=pdf liefert ein PDF', async ({ request }) => {
    await groupWithServices()
    const response = await exportOf(request, `format=pdf&period=${currentMonth()}`)
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/pdf')
    expect(startsWith(await response.body(), '%PDF')).toBe(true)
  })

  test('format=zip enthält Gesamtbericht, Gruppenblätter, Excel und PDF', async ({ request }) => {
    const { id } = await groupWithServices()
    const response = await exportOf(request, `format=zip&period=${currentMonth()}`)
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/zip')
    expect(response.headers()['content-disposition']).toMatch(/filename="verfuegbarkeitsbericht-[\d-]+\.zip"/)
    const body = await response.body()
    expect(startsWith(body, 'PK')).toBe(true)
    const names = Object.keys(unzipSync(new Uint8Array(body)))
    expect(names.some((name) => name.endsWith('/gesamt/01-kennzahlen.png'))).toBe(true)
    expect(names.some((name) => name.endsWith(`/gruppen/export-${id}/00-gruppenblatt.png`))).toBe(true)
    expect(names.filter((name) => name.endsWith('.xlsx'))).toHaveLength(1)
    expect(names.filter((name) => name.endsWith('.pdf'))).toHaveLength(1)
    expect(names.every((name) => /^[a-z0-9\-./]+$/.test(name))).toBe(true)
  })

  test('format=zip mit group enthält nur diese Gruppe', async ({ request }) => {
    const { id, group } = await groupWithServices()
    const response = await exportOf(request, `format=zip&group=${group.id}&period=${currentMonth()}`)
    expect(response.status()).toBe(200)
    const names = Object.keys(unzipSync(new Uint8Array(await response.body())))
    expect(names.length).toBeGreaterThanOrEqual(4)
    expect(names.every((name) => name.includes(`/gruppen/export-${id}/`))).toBe(true)
    expect(response.headers()['content-disposition']).toContain(`export-${id}.zip`)
  })

  test('ungültige Eingaben ergeben Status 400 mit Fehlertext', async ({ request }) => {
    for (const query of [
      `period=${currentMonth()}`,
      `format=csv&period=${currentMonth()}`,
      'format=xlsx&period=2026-13',
      `format=zip&group=99999999&period=${currentMonth()}`,
    ]) {
      const response = await exportOf(request, query)
      expect(response.status(), query).toBe(400)
      expect(typeof (await response.json()).error).toBe('string')
    }
  })

  // Läuft nur gegen einen Server mit PAYLOAD_PUBLIC_ALLOW_WRITES=false (E2E_ACCESS_LOCKED=1), sonst ist die Route offen.
  test('anonyme Anfrage wird mit Status 401 abgewiesen', async ({ request }) => {
    test.skip(process.env.E2E_ACCESS_LOCKED !== '1', 'Server läuft mit offenen Schreibrechten')
    const response = await exportOf(request, `format=xlsx&period=${currentMonth()}`)
    expect(response.status()).toBe(401)
  })
})
