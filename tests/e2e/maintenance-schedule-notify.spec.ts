import { test, expect, type APIRequestContext } from '@playwright/test'
import { createMaintenance, getMaintenance, maintenanceIsStoredAs } from '../utils/payload-helpers'

/**
 * Wartungen nach Zeitplan umstellen (Issue #52): Beginn und Ende stellen den Status um, hängen einen Eintrag an den
 * Verlauf an und lösen eine Meldung aus, die sofort versendet wird. Der Zeitgeber im Server und die Route
 * `POST /api/maintenances/process-due` führen dieselbe Umstellung aus. Die Tests rufen die Route auf und warten, bis der
 * Status gespeichert ist (der Zeitgeber kann zuvorkommen, die Umstellung läuft unter einer Sperre nur einmal).
 */
test.describe.configure({ mode: 'serial' })

const SECOND = 1000
const inSeconds = (seconds: number) => new Date(Date.now() + seconds * SECOND).toISOString()

async function processDue(request: APIRequestContext) {
  const response = await request.post('/api/maintenances/process-due')
  expect(response.ok()).toBe(true)
  return response.json()
}

async function waitStored(request: APIRequestContext, id: number, status: 'in_progress' | 'completed') {
  await expect
    .poll(async () => {
      await processDue(request)
      return maintenanceIsStoredAs(id, status)
    }, { timeout: 40_000, intervals: [1000] })
    .toBe(true)
}

async function notificationsFor(request: APIRequestContext, id: number) {
  const response = await request.get(`/api/notifications?where[relatedMaintenance][equals]=${id}&sort=createdAt&depth=0&limit=20`)
  return (await response.json()).docs as Array<{ status: string; title: string; updateIndex?: number }>
}

test.describe('Wartung nach Zeitplan umstellen', { tag: ['@admin', '@wartungen'] }, () => {
  test('Beginn: Status, Eintrag im Verlauf und eine versandte Meldung', async ({ request }) => {
    test.setTimeout(90_000)
    const created = await createMaintenance({ title: `Zeitplan Beginn ${Date.now()}`, scheduledStartAt: inSeconds(3), scheduledEndAt: inSeconds(3600) })
    expect(created.status).toBe('upcoming')

    await waitStored(request, created.id, 'in_progress')

    const maintenance = await getMaintenance(created.id)
    expect(maintenance.updates).toHaveLength(1)
    expect(maintenance.updates?.[0]).toMatchObject({ status: 'in_progress' })
    expect(maintenance.updates?.[0].message.length).toBeGreaterThan(5)

    // Eine Meldung zum Anlegen (bleibt Entwurf) und eine zur Umstellung (versandt, nicht mehr Entwurf)
    await expect.poll(async () => (await notificationsFor(request, created.id)).length, { timeout: 20_000 }).toBe(2)
    const notifications = await notificationsFor(request, created.id)
    expect(notifications.filter((entry) => entry.status === 'draft')).toHaveLength(1)
    const sent = notifications.find((entry) => entry.updateIndex === 0)
    expect(sent).toBeDefined()
    expect(sent?.status).not.toBe('draft')
  })

  test('mehrfaches Umstellen ändert nichts mehr: kein zweiter Eintrag, keine zweite Meldung', async ({ request }) => {
    test.setTimeout(90_000)
    const created = await createMaintenance({ title: `Zeitplan Einmal ${Date.now()}`, scheduledStartAt: inSeconds(3), scheduledEndAt: inSeconds(3600) })
    await waitStored(request, created.id, 'in_progress')
    await expect.poll(async () => (await notificationsFor(request, created.id)).length, { timeout: 20_000 }).toBe(2)
    for (let round = 0; round < 3; round += 1) await processDue(request)
    expect((await getMaintenance(created.id)).updates).toHaveLength(1)
    expect(await notificationsFor(request, created.id)).toHaveLength(2)
  })

  test('Ende: Status „abgeschlossen“ mit Zeitstempel und Eintrag', async ({ request }) => {
    test.setTimeout(90_000)
    const created = await createMaintenance({ title: `Zeitplan Ende ${Date.now()}`, scheduledStartAt: inSeconds(-3600), scheduledEndAt: inSeconds(4) })
    // Beginn liegt zurück: beim Anlegen läuft die Wartung schon
    expect(created.status).toBe('in_progress')

    await waitStored(request, created.id, 'completed')

    const maintenance = await getMaintenance(created.id)
    expect(maintenance.completedAt).toBeTruthy()
    expect(maintenance.updates?.at(-1)).toMatchObject({ status: 'completed' })
  })

  test('ohne gesetzten Haken bleibt die Wartung stehen und es geht keine Meldung hinaus', async ({ request }) => {
    test.setTimeout(60_000)
    const created = await createMaintenance({
      title: `Zeitplan ohne Haken ${Date.now()}`,
      scheduledStartAt: inSeconds(3),
      scheduledEndAt: inSeconds(3600),
      autoStartOnSchedule: false,
      autoCompleteOnSchedule: false,
    })
    await new Promise((resolve) => setTimeout(resolve, 5 * SECOND))
    await processDue(request)
    expect(await maintenanceIsStoredAs(created.id, 'upcoming')).toBe(true)
    expect(await notificationsFor(request, created.id)).toHaveLength(1)
  })
})
