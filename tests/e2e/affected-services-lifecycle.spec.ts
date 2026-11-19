import { test, expect, type APIRequestContext } from '@playwright/test'
import { createService, createServiceGroup, updateService } from '../utils/payload-helpers'

/**
 * Betroffene Dienste von Störungen und Wartungen: Beendete und noch nicht begonnene Dienste lassen sich nicht eintragen
 * (Collections `incidents` und `maintenances`, auch über die Schnittstelle). Bereits gespeicherte Verknüpfungen bleiben.
 */
const DAY = 24 * 3600 * 1000
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY).toISOString()

const incident = (affectedServices: number[], title = 'Ausfall') => ({
  title,
  impact: 'major',
  affectedServices,
  updates: [{ status: 'investigating', message: 'Text' }],
})

const maintenance = (affectedServices: number[], title = 'Wartung') => ({
  title,
  maintenanceKind: 'sla',
  scheduledStartAt: daysFromNow(2),
  scheduledEndAt: daysFromNow(3),
  affectedServices,
})

async function services(group: number, id: number) {
  const active = await createService({ name: `Auswahl aktiv ${id}`, group, startsAt: daysFromNow(-5) })
  const ended = await createService({ name: `Auswahl beendet ${id}`, group, startsAt: daysFromNow(-5), endsAt: daysFromNow(-1) })
  const future = await createService({ name: `Auswahl später ${id}`, group, startsAt: daysFromNow(3) })
  return { active, ended, future }
}

for (const [collection, build] of [
  ['incidents', incident],
  ['maintenances', maintenance],
] as const) {
  test.describe(`Betroffene Dienste: ${collection}`, { tag: ['@admin', '@dienste', '@stoerungen', '@wartungen'] }, () => {
    test('beendete und noch nicht begonnene Dienste werden beim Anlegen abgelehnt', async ({ request }) => {
      const id = Date.now()
      const group = await createServiceGroup({ name: `Auswahl Gruppe ${collection} ${id}`, icon: 'Server' })
      const { active, ended, future } = await services(group.id, id)

      for (const rejected of [[ended.id], [future.id], [active.id, ended.id]]) {
        const response = await request.post(`/api/${collection}`, { data: build(rejected) })
        expect(response.status()).toBe(400)
      }
      const accepted = await request.post(`/api/${collection}`, { data: build([active.id]) })
      expect(accepted.status()).toBe(201)
    })

    test('eine gespeicherte Verknüpfung bleibt, auch wenn der Dienst danach endet; neue beendete werden abgelehnt', async ({ request }: { request: APIRequestContext }) => {
      const id = Date.now()
      const group = await createServiceGroup({ name: `Auswahl Gruppe B ${collection} ${id}`, icon: 'Server' })
      const { active, ended } = await services(group.id, id)

      const created = await (await request.post(`/api/${collection}`, { data: build([active.id]) })).json()
      const docId = created.doc.id as number
      await updateService(active.id, { endsAt: daysFromNow(-1) })

      // Titel ändern, Verknüpfung unverändert: erlaubt
      const same = await request.patch(`/api/${collection}/${docId}`, { data: { title: `Geändert ${id}`, affectedServices: [active.id] } })
      expect(same.status()).toBe(200)
      // zusätzlich ein anderer beendeter Dienst: abgelehnt
      const more = await request.patch(`/api/${collection}/${docId}`, { data: { affectedServices: [active.id, ended.id] } })
      expect(more.status()).toBe(400)
    })
  })
}
