import { test, expect, type APIRequestContext } from '@playwright/test'
import { createIncident, createMaintenance, createService, createServiceGroup, updateIncident, updateService } from '../utils/payload-helpers'

/**
 * Umwandlung von Wartungsvorfällen in Wartungen: Die Vorschau ändert nichts, das Ausführen legt eine abgeschlossene
 * Wartung an und löscht den Vorfall, ohne Benachrichtigungsentwurf. Ein zweiter Lauf findet nichts mehr.
 */
const DAY = 24 * 3600_000

async function convert(request: APIRequestContext, body: Record<string, unknown> = {}) {
  const response = await request.post('/api/status-log/convert-maintenance', { data: body })
  expect(response.status()).toBe(200)
  return response.json()
}

async function findMaintenances(request: APIRequestContext, title: string) {
  const response = await request.get(`/api/maintenances?where[title][equals]=${encodeURIComponent(title)}&depth=0`)
  expect(response.ok()).toBe(true)
  return (await response.json()).docs as Array<{ id: number; status: string; completedAt: string | null; scheduledStartAt: string }>
}

async function createMaintenanceIncident(title: string, serviceId: number, extra: Record<string, unknown> = {}) {
  const start = new Date(Date.now() - 3 * DAY).toISOString()
  const end = new Date(Date.now() - 3 * DAY + 2 * 3600_000).toISOString()
  const incident = await createIncident({
    title,
    createdAt: start,
    updates: [
      { status: 'investigating', message: 'Wartungsarbeiten laufen.', createdAt: start },
      { status: 'resolved', message: 'Wartung abgeschlossen.', createdAt: end },
    ],
    affectedServices: [serviceId],
  })
  if (Object.keys(extra).length > 0) await updateIncident(incident.id, extra)
  return { incident, start, end }
}

test.describe('Umwandlung der Wartungsvorfälle', () => {
  test.describe.configure({ mode: 'serial' })

  test('Vorschau ändert nichts, Ausführen wandelt um, ein zweiter Lauf findet nichts mehr', async ({ request }) => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Umwandlung ${id}`, icon: 'Server' })
    const service = await createService({ name: `Umwandlung Dienst ${id}`, group: group.id })
    const title = `Nichtverfügbarkeit des Services Umwandlung ${id} aufgrund von Wartungsarbeiten`
    const { incident, end } = await createMaintenanceIncident(title, service.id)

    const preview = await convert(request)
    expect(preview.dryRun).toBe(true)
    expect(preview.converted.some((entry: { title: string }) => entry.title === title)).toBe(true)
    expect((await request.get(`/api/incidents/${incident.id}`)).status()).toBe(200)
    expect(await findMaintenances(request, title)).toHaveLength(0)

    const run = await convert(request, { dryRun: false })
    expect(run.dryRun).toBe(false)
    expect(run.rebuild.dryRun).toBe(false)
    const maintenances = await findMaintenances(request, title)
    expect(maintenances).toHaveLength(1)
    expect(maintenances[0].status).toBe('completed')
    expect(new Date(maintenances[0].completedAt as string).getTime()).toBe(new Date(end).getTime())
    expect((await request.get(`/api/incidents/${incident.id}`)).status()).toBe(404)
    const notifications = await request.get(`/api/notifications?where[relatedMaintenance][equals]=${maintenances[0].id}&limit=1`)
    expect((await notifications.json()).totalDocs).toBe(0)

    const again = await convert(request, { dryRun: false })
    expect(again.converted.some((entry: { title: string }) => entry.title === title)).toBe(false)
    expect(await findMaintenances(request, title)).toHaveLength(1)
  })

  test('offene Vorfälle und Vorfälle mit Einordnung von Hand bleiben unberührt', async ({ request }) => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Umwandlung Rest ${id}`, icon: 'Server' })
    const service = await createService({ name: `Umwandlung Rest Dienst ${id}`, group: group.id })
    const manualTitle = `Wartung von Hand eingeordnet ${id}`
    const { incident: manual } = await createMaintenanceIncident(manualTitle, service.id, { availabilityClass: 'partial' })
    const openTitle = `Wartung noch offen ${id}`
    const open = await createIncident({
      title: openTitle,
      createdAt: new Date(Date.now() - DAY).toISOString(),
      updates: [{ status: 'investigating', message: 'Wartung läuft.', createdAt: new Date(Date.now() - DAY).toISOString() }],
      affectedServices: [service.id],
    })

    const preview = await convert(request)
    const reasons = Object.fromEntries(preview.skipped.map((entry: { title: string; reason: string }) => [entry.title, entry.reason]))
    expect(reasons[manualTitle]).toBe('manual')
    expect(reasons[openTitle]).toBe('open')
    expect(preview.converted.some((entry: { title: string }) => entry.title === manualTitle || entry.title === openTitle)).toBe(false)

    await convert(request, { dryRun: false })
    expect((await request.get(`/api/incidents/${manual.id}`)).status()).toBe(200)
    expect((await request.get(`/api/incidents/${open.id}`)).status()).toBe(200)
  })
  test('eine schon vorhandene Wartung mit gleichem Titel und Beginn wird nicht doppelt angelegt', async ({ request }) => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Umwandlung Dopplung ${id}`, icon: 'Server' })
    const service = await createService({ name: `Umwandlung Dopplung Dienst ${id}`, group: group.id })
    const title = `Nichtverfügbarkeit des Services Dopplung ${id} aufgrund von Wartungsarbeiten`
    const { incident, start, end } = await createMaintenanceIncident(title, service.id)
    // Zustand nach einem abgebrochenen Lauf: Die Wartung besteht schon, der Vorfall noch nicht gelöscht
    await createMaintenance({ title, status: 'completed', scheduledStartAt: start, scheduledEndAt: end, affectedServices: [service.id] })

    await convert(request, { dryRun: false })
    expect(await findMaintenances(request, title)).toHaveLength(1)
    expect((await request.get(`/api/incidents/${incident.id}`)).status()).toBe(404)
  })

  test('das Löschen des Vorfalls lässt von Hand gesetzte Zustände der Dienste unverändert', async ({ request }) => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Umwandlung Zustand ${id}`, icon: 'Server' })
    const service = await createService({ name: `Umwandlung Zustand Dienst ${id}`, group: group.id })
    const title = `Nichtverfügbarkeit des Services Zustand ${id} aufgrund von Wartungsarbeiten`
    await createMaintenanceIncident(title, service.id)
    await updateService(service.id, { status: 'partial' })

    await convert(request, { dryRun: false })
    const response = await request.get(`/api/services/${service.id}`)
    expect((await response.json()).status).toBe('partial')
  })

  test('ein Vorfall mit Wartung im Titel nach dem Start des Statusprotokolls bleibt unberührt', async ({ request }) => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Umwandlung Neu ${id}`, icon: 'Server' })
    const service = await createService({ name: `Umwandlung Neu Dienst ${id}`, group: group.id })
    const title = `Störung nach Wartung ${id}`
    const incident = await createIncident({
      title,
      updates: [
        { status: 'investigating', message: 'Wir untersuchen.' },
        { status: 'resolved', message: 'Behoben.' },
      ],
      affectedServices: [service.id],
    })

    const preview = await convert(request)
    const reasons = Object.fromEntries(preview.skipped.map((entry: { title: string; reason: string }) => [entry.title, entry.reason]))
    expect(reasons[title]).toBe('after-start')
    await convert(request, { dryRun: false })
    expect((await request.get(`/api/incidents/${incident.id}`)).status()).toBe(200)
    expect(await findMaintenances(request, title)).toHaveLength(0)
  })
})
