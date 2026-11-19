import { test, expect, type APIRequestContext } from '@playwright/test'
import { createService, createServiceGroup } from '../utils/payload-helpers'

/**
 * Wartung aus einer Vorlage über die Route `/api/maintenances/from-template`: Die Wartung entsteht wie im Formular (Status „geplant“),
 * die Ankündigung ist die erste Aktualisierung, `{{link}}` wird ersetzt, der Benachrichtigungsentwurf trägt Text, SMS und ntfy.
 * Die Admin-Seite selbst wird in der E2E-Umgebung nicht getestet.
 */
const DAY = 24 * 3600 * 1000
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY).toISOString()
const post = (request: APIRequestContext, data: Record<string, unknown>) => request.post('/api/maintenances/from-template', { data })

async function draftFor(request: APIRequestContext, maintenanceId: number) {
  let found: { smsBody?: string; ntfyBody?: string; emailBody?: string } | undefined
  await expect
    .poll(async () => {
      const response = await request.get(`/api/notifications?where[relatedMaintenance][equals]=${maintenanceId}&limit=1&depth=0`)
      found = (await response.json()).docs?.[0]
      return Boolean(found)
    }, { timeout: 20_000 })
    .toBe(true)
  return found!
}

test.describe('Wartung aus einer Vorlage (Route)', { tag: ['@admin', '@wartungen', '@vorlagen'] }, () => {
  test('Auswirkung auf den Dienst: ohne Angabe „nein“, mit true gesetzt, ein Text wird abgewiesen', async ({ request }) => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Wartung Auswirkung Gruppe ${id}`, icon: 'Server' })
    const service = await createService({ name: `Wartung Auswirkung Dienst ${id}`, group: group.id })
    const body = { title: `Auswirkung ${id}`, message: 'Arbeiten.', maintenanceKind: 'sla', serviceIds: [service.id], start: daysFromNow(2) }

    const plain = await (await post(request, body)).json()
    expect((await (await request.get(`/api/maintenances/${plain.id}?depth=0`)).json()).affectsService).toBe(false)

    const limited = await (await post(request, { ...body, affectsService: true })).json()
    expect((await (await request.get(`/api/maintenances/${limited.id}?depth=0`)).json()).affectsService).toBe(true)

    const bad = await post(request, { ...body, affectsService: 'ja' })
    expect(bad.status()).toBe(400)
    expect((await bad.json()).fields).toEqual(['affectsService'])
  })

  test('legt die Wartung mit der Ankündigung als erster Aktualisierung an und füllt den Entwurf', async ({ request }) => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Wartung Vorlage Gruppe ${id}`, icon: 'Server' })
    const service = await createService({ name: `Wartung Vorlage Dienst ${id}`, group: group.id })

    const response = await post(request, {
      title: `Wartung: Wartung Vorlage Dienst ${id}`,
      message: 'Wir führen Arbeiten durch.\nMehr: {{link}}',
      maintenanceKind: 'additional',
      serviceIds: [service.id],
      start: daysFromNow(2),
      end: daysFromNow(3),
      smsBody: `Wartung ${id}. {{link}}`,
      ntfyBody: `Wartung ${id}.`,
    })
    expect(response.status()).toBe(201)
    const created = await response.json()
    expect(created.shortId).toMatch(/^[A-Za-z0-9]{8}$/)
    expect(created.url).toContain(`/m/${created.shortId}`)

    const maintenance = await (await request.get(`/api/maintenances/${created.id}?depth=0`)).json()
    expect(maintenance.status).toBe('upcoming')
    expect(maintenance.maintenanceKind).toBe('additional')
    expect(maintenance.affectedServices).toEqual([service.id])
    expect(maintenance.scheduledEndAt).toBeTruthy()
    expect(maintenance.updates).toHaveLength(1)
    expect(maintenance.updates[0].status).toBe('upcoming')
    expect(maintenance.updates[0].message).toContain(created.url)
    expect(maintenance.updates[0].message).not.toContain('{{link}}')

    const draft = await draftFor(request, created.id)
    expect(draft.emailBody).toContain('Wir führen Arbeiten durch.')
    expect(draft.emailBody).toContain(created.url)
    expect(draft.smsBody).toBe(`Wartung ${id}. ${created.url}`)
    expect(draft.ntfyBody).toBe(`Wartung ${id}.`)
  })

  test('das Ende ist optional', async ({ request }) => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Wartung Vorlage Gruppe B ${id}`, icon: 'Server' })
    const service = await createService({ name: `Wartung Vorlage Dienst B ${id}`, group: group.id })
    const response = await post(request, { title: `Wartung ohne Ende ${id}`, message: 'Text', maintenanceKind: 'sla', serviceIds: [service.id], start: daysFromNow(2) })
    expect(response.status()).toBe(201)
    const maintenance = await (await request.get(`/api/maintenances/${(await response.json()).id}?depth=0`)).json()
    expect(maintenance.scheduledEndAt ?? null).toBeNull()
    expect(maintenance.updates).toHaveLength(1)
  })

  test('ohne Vorlagentexte bleibt der Entwurf beim Standardtext', async ({ request }) => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Wartung Vorlage Gruppe C ${id}`, icon: 'Server' })
    const service = await createService({ name: `Wartung Vorlage Dienst C ${id}`, group: group.id })
    const created = await (await post(request, { title: `Wartung C ${id}`, message: 'Text C', maintenanceKind: 'sla', serviceIds: [service.id], start: daysFromNow(2) })).json()
    const draft = await draftFor(request, created.id)
    expect(draft.smsBody).toContain('MAINTENANCE')
    expect(draft.ntfyBody ?? null).toBeNull()
  })

  test('unvollständige oder ungültige Eingaben und beendete Dienste werden abgelehnt', async ({ request }) => {
    const empty = await post(request, {})
    expect(empty.status()).toBe(400)
    expect((await empty.json()).fields).toEqual(['title', 'message', 'maintenanceKind', 'start', 'serviceIds'])

    const id = Date.now()
    const group = await createServiceGroup({ name: `Wartung Vorlage Gruppe D ${id}`, icon: 'Server' })
    const active = await createService({ name: `Wartung D aktiv ${id}`, group: group.id, startsAt: daysFromNow(-5) })
    const ended = await createService({ name: `Wartung D beendet ${id}`, group: group.id, startsAt: daysFromNow(-5), endsAt: daysFromNow(-1) })

    const endBeforeStart = await post(request, { title: 'T', message: 'M', maintenanceKind: 'sla', serviceIds: [active.id], start: daysFromNow(3), end: daysFromNow(2) })
    expect(endBeforeStart.status()).toBe(400)
    expect((await endBeforeStart.json()).fields).toEqual(['end'])

    const withoutKind = await post(request, { title: 'T', message: 'M', serviceIds: [active.id], start: daysFromNow(2) })
    expect(withoutKind.status()).toBe(400)
    expect((await withoutKind.json()).fields).toEqual(['maintenanceKind'])

    const rejected = await post(request, { title: 'T', message: 'M', maintenanceKind: 'sla', serviceIds: [active.id, ended.id], start: daysFromNow(2) })
    expect(rejected.status()).toBe(400)
    expect((await rejected.json()).fields).toEqual(['serviceIds'])
  })
})
