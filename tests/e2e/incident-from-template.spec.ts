import { test, expect, type APIRequestContext } from '@playwright/test'
import { createService, createServiceGroup } from '../utils/payload-helpers'

/**
 * Störung aus einer Vorlage über die Route `/api/incidents/from-template`: Die Störung entsteht wie im Formular, SMS- und ntfy-Text
 * kommen in den Benachrichtigungsentwurf, `{{link}}` wird ersetzt, die Texte der Aktualisierung sind öffentlich nicht lesbar.
 * Die Admin-Seite selbst wird in der E2E-Umgebung nicht getestet.
 */
async function post(request: APIRequestContext, data: Record<string, unknown>) {
  return request.post('/api/incidents/from-template', { data })
}

async function draftFor(request: APIRequestContext, incidentId: number) {
  let found: { smsBody?: string; ntfyBody?: string; subject?: string; status?: string } | undefined
  await expect
    .poll(async () => {
      const response = await request.get(`/api/notifications?where[relatedIncident][equals]=${incidentId}&limit=1&depth=0`)
      found = (await response.json()).docs?.[0]
      return Boolean(found)
    }, { timeout: 20_000 })
    .toBe(true)
  return found!
}

test.describe('Störung aus einer Vorlage (Route)', () => {
  test('legt die Störung an, setzt den Dienstzustand und füllt den Benachrichtigungsentwurf', async ({ request }) => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Vorlage Gruppe ${id}`, icon: 'Server' })
    const service = await createService({ name: `Vorlage Dienst ${id}`, group: group.id })

    const response = await post(request, {
      title: `Teilweiser Ausfall: Vorlage Dienst ${id}`,
      message: 'Derzeit kommt es zu Einschränkungen.\nMehr: {{link}}',
      impact: 'partial',
      serviceIds: [service.id],
      smsBody: `Teilausfall: Vorlage Dienst ${id}. {{link}}`,
      ntfyBody: `Teilausfall bei Vorlage Dienst ${id}.`,
    })
    expect(response.status()).toBe(201)
    const created = await response.json()
    expect(created.shortId).toMatch(/^[A-Za-z0-9]{8}$/)
    expect(created.url).toContain(`/i/${created.shortId}`)

    // Störung: Status „wird untersucht“, Link ersetzt, SMS- und ntfy-Text öffentlich nicht lesbar (Testmodus liest alles: nur der Link zählt)
    const incident = await (await request.get(`/api/incidents/${created.id}?depth=0`)).json()
    expect(incident.title).toBe(`Teilweiser Ausfall: Vorlage Dienst ${id}`)
    expect(incident.status).toBe('investigating')
    expect(incident.impact).toBe('partial')
    expect(incident.updates[0].message).toContain(created.url)
    expect(incident.updates[0].message).not.toContain('{{link}}')

    // Dienstzustand wie im Formular
    const serviceNow = await (await request.get(`/api/services/${service.id}?depth=0`)).json()
    expect(serviceNow.status).toBe('partial')

    // Benachrichtigungsentwurf mit eigenem SMS- und ntfy-Text, Link ersetzt
    const draft = await draftFor(request, created.id)
    expect(draft.status).toBe('draft')
    expect(draft.smsBody).toBe(`Teilausfall: Vorlage Dienst ${id}. ${created.url}`)
    expect(draft.ntfyBody).toBe(`Teilausfall bei Vorlage Dienst ${id}.`)
  })

  test('ohne SMS- und ntfy-Text bleibt der Entwurf wie bisher (allgemeiner SMS-Text, kein ntfy-Text)', async ({ request }) => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Vorlage Gruppe B ${id}`, icon: 'Server' })
    const service = await createService({ name: `Vorlage Dienst B ${id}`, group: group.id })
    const response = await post(request, { title: `Störung B ${id}`, message: 'Wir analysieren.', impact: 'degraded', serviceIds: [service.id] })
    expect(response.status()).toBe(201)
    const draft = await draftFor(request, (await response.json()).id)
    expect(draft.smsBody).toContain(`Störung B ${id}`)
    expect(draft.ntfyBody ?? null).toBeNull()
  })

  test('mehrere Dienste: alle bekommen den Zustand', async ({ request }) => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Vorlage Gruppe C ${id}`, icon: 'Server' })
    const a = await createService({ name: `Vorlage C A ${id}`, group: group.id })
    const b = await createService({ name: `Vorlage C B ${id}`, group: group.id })
    const response = await post(request, { title: `Ausfall C ${id}`, message: 'Text', impact: 'major', serviceIds: [a.id, b.id] })
    expect(response.status()).toBe(201)
    for (const service of [a, b]) {
      expect((await (await request.get(`/api/services/${service.id}?depth=0`)).json()).status).toBe('major')
    }
  })

  test('beendete und noch nicht begonnene Dienste werden abgelehnt, auch neben einem aktiven', async ({ request }) => {
    const id = Date.now()
    const day = 24 * 3600 * 1000
    const daysFromNow = (days: number) => new Date(Date.now() + days * day).toISOString()
    const group = await createServiceGroup({ name: `Vorlage Gruppe D ${id}`, icon: 'Server' })
    const active = await createService({ name: `Vorlage D aktiv ${id}`, group: group.id, startsAt: daysFromNow(-5) })
    const ended = await createService({ name: `Vorlage D beendet ${id}`, group: group.id, startsAt: daysFromNow(-5), endsAt: daysFromNow(-1) })
    const future = await createService({ name: `Vorlage D später ${id}`, group: group.id, startsAt: daysFromNow(3) })

    for (const rejected of [[ended.id], [future.id], [active.id, ended.id]]) {
      const response = await post(request, { title: `Ausfall D ${id}`, message: 'Text', impact: 'major', serviceIds: rejected })
      expect(response.status()).toBe(400)
      expect((await response.json()).fields).toEqual(['serviceIds'])
    }
    // Abgelehnt heißt: nichts verändert
    expect((await (await request.get(`/api/services/${ended.id}?depth=0`)).json()).status).toBe('operational')
    expect((await post(request, { title: `Ausfall D ${id}`, message: 'Text', impact: 'major', serviceIds: [active.id] })).status()).toBe(201)
  })

  test('eine unvollständige oder ungültige Eingabe wird mit den betroffenen Feldern abgelehnt', async ({ request }) => {
    const empty = await post(request, {})
    expect(empty.status()).toBe(400)
    expect((await empty.json()).fields).toEqual(['title', 'message', 'impact', 'serviceIds'])
    const noService = await post(request, { title: 'T', message: 'M', impact: 'partial', serviceIds: [999999999] })
    expect(noService.status()).toBe(400)
    expect((await noService.json()).fields).toEqual(['serviceIds'])
    const tooLong = await post(request, { title: 'T', message: 'M', impact: 'partial', serviceIds: [1], smsBody: 'x'.repeat(321) })
    expect(tooLong.status()).toBe(400)
    expect((await tooLong.json()).fields).toEqual(['smsBody'])
  })
})
