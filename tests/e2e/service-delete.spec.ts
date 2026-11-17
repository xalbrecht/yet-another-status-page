import { test, expect } from '@playwright/test'
import { createService, createServiceGroup, updateService } from '../utils/payload-helpers'

const API_BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const DAY = 24 * 3600 * 1000
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY).toISOString()

const eventsOf = async (serviceId: number) =>
  (await (await fetch(`${API_BASE}/api/service-status-events?where[service][equals]=${serviceId}`)).json()).totalDocs as number
const remove = (serviceId: number) => fetch(`${API_BASE}/api/services/${serviceId}`, { method: 'DELETE' })

/**
 * Löschen eines Dienstes: nur nach dem Ende, die Einträge im Statusprotokoll entfallen mit dem Dienst.
 * Vorher antwortete die Schnittstelle mit HTTP 500 (NOT NULL am Fremdschlüssel).
 */
test.describe('Dienst löschen', () => {
  test('löscht einen beendeten Dienst samt Statusprotokoll', async () => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Löschen Gruppe ${id}` })
    const service = await createService({ name: `Löschen Dienst ${id}`, group: group.id, startsAt: daysFromNow(-3), endsAt: daysFromNow(-1) })
    await updateService(service.id, { status: 'partial' })
    expect(await eventsOf(service.id)).toBeGreaterThanOrEqual(2)

    expect((await remove(service.id)).status).toBe(200)

    expect((await fetch(`${API_BASE}/api/services/${service.id}`)).status).toBe(404)
    expect(await eventsOf(service.id)).toBe(0)
  })

  test('lässt andere Dienste und ihre Einträge unberührt', async () => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Löschen Gruppe B ${id}` })
    const gone = await createService({ name: `Löschen weg ${id}`, group: group.id, startsAt: daysFromNow(-3), endsAt: daysFromNow(-1) })
    const kept = await createService({ name: `Löschen bleibt ${id}`, group: group.id })

    expect((await remove(gone.id)).status).toBe(200)

    expect(await eventsOf(kept.id)).toBeGreaterThanOrEqual(1)
  })

  test('verweigert das Löschen eines aktiven Dienstes ohne Ende mit 409', async () => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Löschen Gruppe C ${id}` })
    const service = await createService({ name: `Löschen aktiv ${id}`, group: group.id })

    expect((await remove(service.id)).status).toBe(409)

    expect((await fetch(`${API_BASE}/api/services/${service.id}`)).status).toBe(200)
    expect(await eventsOf(service.id)).toBeGreaterThanOrEqual(1)
  })

  test('verweigert das Löschen bei einem Ende in der Zukunft mit 409', async () => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Löschen Gruppe D ${id}` })
    const service = await createService({ name: `Löschen später ${id}`, group: group.id, startsAt: daysFromNow(-3), endsAt: daysFromNow(2) })

    expect((await remove(service.id)).status).toBe(409)

    expect((await fetch(`${API_BASE}/api/services/${service.id}`)).status).toBe(200)
    expect(await eventsOf(service.id)).toBeGreaterThanOrEqual(1)
  })
})
