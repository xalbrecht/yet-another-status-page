import { test, expect, type APIRequestContext } from '@playwright/test'

/**
 * Vorlagen für Meldungen über die JSON-Route der Collection. Die Testumgebung läuft mit offenen Schreibrechten, der gesperrte
 * Zugriff ohne Anmeldung ist deshalb in `tests/unit/message-templates-access.test.ts` geprüft. Die Admin-Seite selbst wird in der
 * E2E-Umgebung nicht getestet.
 */
const valid = {
  name: 'E2E Wird untersucht',
  kind: 'incident',
  status: 'investigating',
  title: 'Störung: {{services}}',
  body: 'Betroffen: {{services}} ({{group}}). Mehr: {{link}}',
}

async function create(request: APIRequestContext, data: Record<string, unknown>) {
  return request.post('/api/message-templates', { data: { ...valid, name: `${valid.name} ${Date.now()}`, ...data } })
}

async function errorFields(response: Awaited<ReturnType<typeof create>>): Promise<string[]> {
  const body = await response.json()
  return (body.errors?.[0]?.data?.errors ?? []).map((error: { path: string }) => error.path)
}

test.describe('Vorlagen (Route)', () => {
  test('legt eine Vorlage an und liefert sie wieder aus, SMS- und ntfy-Text sind optional', async ({ request }) => {
    const response = await create(request, { smsBody: 'Störung: {{services}} {{link}}', ntfyBody: '{{services}}: Analyse' })
    expect(response.status()).toBe(201)
    const doc = (await response.json()).doc
    const read = await request.get(`/api/message-templates/${doc.id}`)
    expect(read.status()).toBe(200)
    const body = await read.json()
    expect(body.title).toBe(valid.title)
    expect(body.smsBody).toBe('Störung: {{services}} {{link}}')
    expect(body.ntfyBody).toBe('{{services}}: Analyse')
  })

  test('ein Platzhalter, der für die Art nicht erlaubt ist, wird abgelehnt', async ({ request }) => {
    const unknown = await create(request, { body: 'Betroffen: {{dienste}}' })
    expect(unknown.status()).toBe(400)
    expect(await errorFields(unknown)).toContain('body')
    const wrongKind = await create(request, { title: 'ab {{start}}' })
    expect(wrongKind.status()).toBe(400)
    expect(await errorFields(wrongKind)).toContain('title')
    // bei einer Wartung ist er erlaubt
    const maintenance = await create(request, { kind: 'maintenance', status: 'upcoming', title: 'Wartung ab {{start}} bis {{end}}' })
    expect(maintenance.status()).toBe(201)
  })

  test('ein Status, der nicht zur Art gehört, wird abgelehnt', async ({ request }) => {
    const response = await create(request, { kind: 'incident', status: 'completed' })
    expect(response.status()).toBe(400)
    expect(await errorFields(response)).toContain('status')
    const maintenance = await create(request, { kind: 'maintenance', status: 'investigating' })
    expect(maintenance.status()).toBe(400)
  })

  test('Titel und Text sind Pflicht, SMS- und ntfy-Text haben eine Längengrenze', async ({ request }) => {
    expect((await create(request, { title: '  ' })).status()).toBe(400)
    expect((await create(request, { body: '' })).status()).toBe(400)
    expect((await create(request, { smsBody: 'x'.repeat(321) })).status()).toBe(400)
    expect((await create(request, { smsBody: 'x'.repeat(320) })).status()).toBe(201)
    expect((await create(request, { ntfyBody: 'x'.repeat(501) })).status()).toBe(400)
    expect((await create(request, { ntfyBody: 'x'.repeat(500) })).status()).toBe(201)
  })

  test('die Auswirkung gibt es nur bei Störungen: bei einer Wartung wird sie verworfen', async ({ request }) => {
    const incident = await create(request, { impact: 'partial' })
    expect((await incident.json()).doc.impact).toBe('partial')
    const maintenance = await create(request, { kind: 'maintenance', status: 'in_progress', impact: 'major', title: 'Wartung läuft' })
    expect(maintenance.status()).toBe(201)
    expect((await maintenance.json()).doc.impact).toBeNull()
  })

  test('eine Vorlage taucht auf keiner öffentlichen Seite und in keinem Feed auf', async ({ request }) => {
    const marker = `Marker${Date.now()}`
    expect((await create(request, { title: `Titel ${marker} {{services}}`, body: `Text ${marker}` })).status()).toBe(201)
    for (const path of ['/', '/history', '/feed.atom', '/maintenances.ics', '/api/v1/incidents', '/api/v1/maintenances']) {
      const response = await request.get(path)
      expect((await response.text()).includes(marker), path).toBe(false)
    }
  })
})
