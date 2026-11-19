import { test, expect, type APIRequestContext } from '@playwright/test'
import { createIncident, createMaintenance, createService, createServiceGroup, updateIncident, updateService } from '../utils/payload-helpers'

/**
 * Umwandlung von Wartungsvorfällen in Wartungen: Die Vorschau ändert nichts, das Ausführen legt eine abgeschlossene
 * Wartung an und löscht den Vorfall, ohne Benachrichtigungsentwurf. Ein zweiter Lauf findet nichts mehr.
 * Welche Vorfälle als Wartung gelten, entscheiden die Regeln in den Einstellungen (`classificationRules`).
 */
const DAY = 24 * 3600_000

async function convert(request: APIRequestContext, body: Record<string, unknown> = {}) {
  const response = await request.post('/api/status-log/convert-maintenance', { data: body })
  expect(response.status()).toBe(200)
  return response.json()
}

/** Ausführen wie die Oberfläche: erst Vorschau, dann Ausführen mit deren Prüfwert (`check`). */
async function convertRun(request: APIRequestContext) {
  const preview = await convert(request)
  return convert(request, { dryRun: false, expect: preview.check })
}

async function findMaintenances(request: APIRequestContext, title: string) {
  const response = await request.get(`/api/maintenances?where[title][equals]=${encodeURIComponent(title)}&depth=0`)
  expect(response.ok()).toBe(true)
  return (await response.json()).docs as Array<{ id: number; status: string; maintenanceKind: string; completedAt: string | null; scheduledStartAt: string }>
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

/** Regeln der automatischen Einordnung in den Einstellungen setzen (leere Liste: keine Regeln). */
async function setRules(request: APIRequestContext, rules: Array<Record<string, string>>) {
  const response = await request.post('/api/globals/settings', { data: { classificationRules: rules } })
  expect(response.ok(), await response.text()).toBe(true)
}

const MAINTENANCE_RULE = { field: 'title', match: 'contains', words: 'wartung', classification: 'maintenance' }

test.describe('Umwandlung der Wartungsvorfälle', { tag: ['@admin', '@wartungen', '@statusprotokoll'] }, () => {
  test.describe.configure({ mode: 'serial' })

  test('ohne Regel wird nichts umgewandelt, mit der Regel „Titel enthält wartung“ schon', async ({ request }) => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Regel ${id}`, icon: 'Server' })
    const service = await createService({ name: `Regel Dienst ${id}`, group: group.id })
    const title = `Nichtverfügbarkeit des Services Regel ${id} aufgrund von Wartungsarbeiten`
    await createMaintenanceIncident(title, service.id)

    await setRules(request, [])
    const without = await convert(request)
    expect(without.converted.some((entry: { title: string }) => entry.title === title)).toBe(false)

    // Die Regel bleibt für die folgenden Tests dieser Datei gesetzt
    await setRules(request, [MAINTENANCE_RULE])
    const withRule = await convert(request)
    expect(withRule.dryRun).toBe(true)
    expect(withRule.converted.some((entry: { title: string }) => entry.title === title)).toBe(true)
  })

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

    const run = await convert(request, { dryRun: false, expect: preview.check })
    expect(run.dryRun).toBe(false)
    expect(run.rebuild.dryRun).toBe(false)
    const maintenances = await findMaintenances(request, title)
    expect(maintenances).toHaveLength(1)
    expect(maintenances[0].status).toBe('completed')
    expect(maintenances[0].maintenanceKind).toBe('sla')
    expect(new Date(maintenances[0].completedAt as string).getTime()).toBe(new Date(end).getTime())
    expect((await request.get(`/api/incidents/${incident.id}`)).status()).toBe(404)
    const notifications = await request.get(`/api/notifications?where[relatedMaintenance][equals]=${maintenances[0].id}&limit=1`)
    expect((await notifications.json()).totalDocs).toBe(0)

    const again = await convertRun(request)
    expect(again.converted.some((entry: { title: string }) => entry.title === title)).toBe(false)
    expect(await findMaintenances(request, title)).toHaveLength(1)
  })

  test('Ausführen ohne Vorschau wird abgelehnt, mit veralteter Vorschau ebenso, und nichts wird geändert', async ({ request }) => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Umwandlung Prüfung ${id}`, icon: 'Server' })
    const service = await createService({ name: `Umwandlung Prüfung Dienst ${id}`, group: group.id })
    const title = `Nichtverfügbarkeit des Services Prüfung ${id} aufgrund von Wartungsarbeiten`
    const { incident } = await createMaintenanceIncident(title, service.id)

    const noExpect = await request.post('/api/status-log/convert-maintenance', { data: { dryRun: false } })
    expect(noExpect.status()).toBe(400)

    const preview = await convert(request)
    // Zwischen Vorschau und Ausführen kommt ein weiterer Wartungsvorfall dazu (oder die andere Aktion ändert den Bestand)
    const other = await createMaintenanceIncident(`Nichtverfügbarkeit des Services Prüfung zwei ${id} aufgrund von Wartungsarbeiten`, service.id)
    const stale = await request.post('/api/status-log/convert-maintenance', { data: { dryRun: false, expect: preview.check } })
    expect(stale.status()).toBe(409)
    const message = (await stale.json()).error as string
    expect(message).toMatch(/Vorschau|preview/)
    expect(message).toContain(String(preview.check.count))
    expect(await findMaintenances(request, title)).toHaveLength(0)
    expect((await request.get(`/api/incidents/${incident.id}`)).status()).toBe(200)
    expect((await request.get(`/api/incidents/${other.incident.id}`)).status()).toBe(200)

    // Nach einer neuen Vorschau läuft es
    await convertRun(request)
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

    await convertRun(request)
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

    await convertRun(request)
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

    await convertRun(request)
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
    await convertRun(request)
    expect((await request.get(`/api/incidents/${incident.id}`)).status()).toBe(200)
    expect(await findMaintenances(request, title)).toHaveLength(0)
  })
})
