import { test, expect } from '@playwright/test'
import { createService, createServiceGroup, updateService } from '../utils/payload-helpers'

const API_BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'

/**
 * Löschen eines Dienstes: Die Einträge im Statusprotokoll entfallen mit dem Dienst.
 * Vorher antwortete die Schnittstelle mit HTTP 500 (NOT NULL am Fremdschlüssel).
 */
test.describe('Dienst löschen', () => {
  test('löscht den Dienst samt Statusprotokoll', async () => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Löschen Gruppe ${id}` })
    const service = await createService({ name: `Löschen Dienst ${id}`, group: group.id })
    await updateService(service.id, { status: 'partial' })

    const before = await (await fetch(`${API_BASE}/api/service-status-events?where[service][equals]=${service.id}`)).json()
    expect(before.totalDocs).toBeGreaterThanOrEqual(2)

    const response = await fetch(`${API_BASE}/api/services/${service.id}`, { method: 'DELETE' })
    expect(response.status).toBe(200)

    expect((await fetch(`${API_BASE}/api/services/${service.id}`)).status).toBe(404)
    const after = await (await fetch(`${API_BASE}/api/service-status-events?where[service][equals]=${service.id}`)).json()
    expect(after.totalDocs).toBe(0)
  })

  test('lässt andere Dienste und ihre Einträge unberührt', async () => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Löschen Gruppe B ${id}` })
    const gone = await createService({ name: `Löschen weg ${id}`, group: group.id })
    const kept = await createService({ name: `Löschen bleibt ${id}`, group: group.id })

    expect((await fetch(`${API_BASE}/api/services/${gone.id}`, { method: 'DELETE' })).status).toBe(200)

    const events = await (await fetch(`${API_BASE}/api/service-status-events?where[service][equals]=${kept.id}`)).json()
    expect(events.totalDocs).toBeGreaterThanOrEqual(1)
  })
})
