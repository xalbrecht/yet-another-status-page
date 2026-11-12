import { test, expect, type APIRequestContext } from '@playwright/test'
import { createIncident, createService, createServiceGroup } from '../utils/payload-helpers'

/**
 * Daten der Berichtsseite über die JSON-Route. Die Admin-Seite selbst wird in der E2E-Umgebung nicht getestet.
 */
const currentMonth = () => new Date().toISOString().slice(0, 7)

async function report(request: APIRequestContext, query: string) {
  return request.get(`/api/availability-report?${query}`)
}

test.describe('Verfügbarkeitsbericht (Route)', () => {
  test('liefert Kennzahlen und Rangliste für eine Gruppe', async ({ request }) => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Bericht ${id}`, icon: 'Server' })
    const a = await createService({ name: `Bericht Dienst A ${id}`, group: group.id })
    const b = await createService({ name: `Bericht Dienst B ${id}`, group: group.id })
    await createIncident({
      title: `Störung Bericht ${id} - Analysephase`,
      updates: [{ status: 'investigating', message: 'Wir untersuchen.' }],
      affectedServices: [a.id],
      impact: 'partial',
    })

    const response = await report(request, `period=${currentMonth()}&group=${group.id}`)
    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data.kpis.serviceCount).toBe(2)
    expect(data.ranking.map((row: { name: string }) => row.name).sort()).toEqual([a.name, b.name].sort())
    expect(data.heat.columns).toHaveLength(12)
    expect(data.period.partial).toBe(true)
  })

  test('ungültige Eingaben ergeben Status 400 mit Fehlertext', async ({ request }) => {
    for (const query of ['period=2026-13', 'period=custom&from=2026-10-05&to=2026-10-01', `period=${currentMonth()}&group=99999999`]) {
      const response = await report(request, query)
      expect(response.status(), query).toBe(400)
      expect(typeof (await response.json()).error).toBe('string')
    }
  })

  test('die Anzahl der schwächsten Dienste ist auf 10 begrenzt', async ({ request }) => {
    const response = await report(request, `period=${currentMonth()}&topN=99`)
    expect(response.status()).toBe(200)
    expect((await response.json()).weakest.length).toBeLessThanOrEqual(10)
  })

  // Läuft nur, wenn der Server mit PAYLOAD_PUBLIC_ALLOW_WRITES=false gestartet wurde (E2E_ACCESS_LOCKED=1),
  // da die Testumgebung sonst alle Routen offen lässt.
  test('anonyme Anfrage wird mit Status 401 abgewiesen', async ({ request }) => {
    test.skip(process.env.E2E_ACCESS_LOCKED !== '1', 'Server läuft mit offenen Schreibrechten')
    const response = await report(request, `period=${currentMonth()}`)
    expect(response.status()).toBe(401)
  })
})
