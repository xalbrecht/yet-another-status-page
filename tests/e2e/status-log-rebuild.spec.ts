import { test, expect, type APIRequestContext } from '@playwright/test'
import { createIncident, createService, createServiceGroup, updateIncident } from '../utils/payload-helpers'

/**
 * Nachrechnung des Statusprotokolls aus dem Admin: Vorschau schreibt nichts, Ausführen ersetzt nur die Zeilen mit
 * Quelle „reconstructed“, die Betriebseinträge bleiben, ein zweiter Lauf ändert nichts.
 */
const DAY = 24 * 3600_000

async function countEvents(request: APIRequestContext, source: 'operation' | 'reconstructed'): Promise<number> {
  const response = await request.get(`/api/service-status-events?where[source][equals]=${source}&limit=1`)
  expect(response.ok()).toBe(true)
  return (await response.json()).totalDocs
}

async function rebuild(request: APIRequestContext, body: Record<string, unknown> = {}) {
  const response = await request.post('/api/status-log/rebuild', { data: body })
  expect(response.status()).toBe(200)
  return response.json()
}

test.describe('Nachrechnung des Statusprotokolls', { tag: ['@admin', '@statusprotokoll'] }, () => {
  test.describe.configure({ mode: 'serial' })

  test('Vorschau schreibt nichts, Ausführen ersetzt nur nachgerechnete Zeilen und lässt sich wiederholen', async ({ request }) => {
    const before = await rebuild(request)
    expect(before.dryRun).toBe(true)

    const id = Date.now()
    const group = await createServiceGroup({ name: `Rebuild ${id}`, icon: 'Server' })
    const service = await createService({ name: `Rebuild Dienst ${id}`, group: group.id })
    const incident = await createIncident({
      title: `Störung Rebuild ${id} - Analysephase`,
      createdAt: new Date(Date.now() - 10 * DAY).toISOString(),
      updates: [
        { status: 'investigating', message: 'Wir untersuchen.', createdAt: new Date(Date.now() - 10 * DAY).toISOString() },
        { status: 'resolved', message: 'Behoben.', createdAt: new Date(Date.now() - 9 * DAY).toISOString() },
      ],
      affectedServices: [service.id],
    })
    await updateIncident(incident.id, { availabilityClass: 'major' })

    const preview = await rebuild(request)
    expect(preview.dryRun).toBe(true)
    expect(preview.incidents).toBe(before.incidents + 1)
    expect(preview.counts.major ?? 0).toBe((before.counts.major ?? 0) + 1)
    expect(preview.reconstructedAfter).toBeGreaterThan(0)

    const reconstructedBefore = await countEvents(request, 'reconstructed')
    const operationBefore = await countEvents(request, 'operation')
    expect(reconstructedBefore).toBe(preview.reconstructedBefore)

    const run = await rebuild(request, { dryRun: false, expect: preview.check })
    expect(run.dryRun).toBe(false)
    expect(await countEvents(request, 'reconstructed')).toBe(run.reconstructedAfter)
    expect(await countEvents(request, 'operation')).toBe(operationBefore)

    // Ein zweiter Lauf braucht eine neue Vorschau: Die Zahl der vorhandenen nachgerechneten Einträge hat sich geändert
    const previewAgain = await rebuild(request)
    const again = await rebuild(request, { dryRun: false, expect: previewAgain.check })
    expect(again.reconstructedAfter).toBe(run.reconstructedAfter)
    expect(await countEvents(request, 'reconstructed')).toBe(run.reconstructedAfter)
    expect(await countEvents(request, 'operation')).toBe(operationBefore)
  })

  test('Ausführen ohne Vorschau wird abgelehnt, mit veralteter Vorschau ebenso, und nichts wird geschrieben', async ({ request }) => {
    const noExpect = await request.post('/api/status-log/rebuild', { data: { dryRun: false } })
    expect(noExpect.status()).toBe(400)

    const preview = await rebuild(request)
    const reconstructedBefore = await countEvents(request, 'reconstructed')
    // Zwischen Vorschau und Ausführen kommt ein weiterer Vorfall dazu
    const id = Date.now()
    const group = await createServiceGroup({ name: `Rebuild Prüfung ${id}`, icon: 'Server' })
    const service = await createService({ name: `Rebuild Prüfung Dienst ${id}`, group: group.id })
    const incident = await createIncident({
      title: `Störung Rebuild Prüfung ${id}`,
      createdAt: new Date(Date.now() - 8 * DAY).toISOString(),
      updates: [{ status: 'resolved', message: 'Behoben.', createdAt: new Date(Date.now() - 7 * DAY).toISOString() }],
      affectedServices: [service.id],
    })
    await updateIncident(incident.id, { availabilityClass: 'major' })

    const stale = await request.post('/api/status-log/rebuild', { data: { dryRun: false, expect: preview.check } })
    expect(stale.status()).toBe(409)
    const message = (await stale.json()).error as string
    expect(message).toMatch(/Vorschau|preview/)
    expect(message).toContain(String(preview.check.count))
    expect(await countEvents(request, 'reconstructed')).toBe(reconstructedBefore)
  })
})
