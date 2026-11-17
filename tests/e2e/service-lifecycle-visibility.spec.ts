import { test, expect } from '@playwright/test'
import { createService, createServiceGroup, updateSettings } from '../utils/payload-helpers'

const DAY = 24 * 3600 * 1000
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY).toISOString()

/**
 * Beendete Dienste und Dienste, die noch nicht begonnen haben, erscheinen weder auf der Statusseite
 * noch im Lagebild noch in der Schnittstelle. Eine Gruppe nur mit solchen Diensten erscheint nicht.
 */
test.describe('Sichtbarkeit nach Beginn und Ende', () => {
  test.describe.configure({ mode: 'serial' })

  const id = Date.now()
  const names = {
    mixedGroup: `Sicht Gruppe ${id}`,
    emptyGroup: `Sicht Leer ${id}`,
    active: `Sicht Aktiv ${id}`,
    ended: `Sicht Beendet ${id}`,
    notStarted: `Sicht Spaeter ${id}`,
    onlyEnded: `Sicht NurBeendet ${id}`,
  }
  let mixedGroupId = 0

  test.beforeAll(async () => {
    const mixed = await createServiceGroup({ name: names.mixedGroup, icon: 'Server' })
    const empty = await createServiceGroup({ name: names.emptyGroup, icon: 'Server' })
    mixedGroupId = mixed.id
    await createService({ name: names.active, group: mixed.id, startsAt: daysFromNow(-5) })
    await createService({ name: names.ended, group: mixed.id, startsAt: daysFromNow(-5), endsAt: daysFromNow(-1) })
    await createService({ name: names.notStarted, group: mixed.id, startsAt: daysFromNow(3) })
    await createService({ name: names.onlyEnded, group: empty.id, startsAt: daysFromNow(-5), endsAt: daysFromNow(-1) })
  })

  test.afterAll(async () => {
    await updateSettings({ lagebildVariant: 'off' })
  })

  test('Statusseite zeigt nur den aktiven Dienst und keine Gruppe ohne aktive Dienste', async ({ page }) => {
    await updateSettings({ lagebildVariant: 'off' })
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    await expect(page.getByText(names.active)).toBeVisible()
    await expect(page.getByText(names.ended)).toHaveCount(0)
    await expect(page.getByText(names.notStarted)).toHaveCount(0)
    await expect(page.getByText(names.onlyEnded)).toHaveCount(0)
    await expect(page.getByText(names.emptyGroup)).toHaveCount(0)
  })

  test('Lagebild zeigt nach dem Aufklappen nur den aktiven Dienst und keine leere Gruppe', async ({ page }) => {
    await updateSettings({ lagebildVariant: 'a' })
    await page.goto('/')
    const view = page.getByTestId('lagebild-a')
    await expect(view.locator('button[aria-expanded]', { hasText: names.emptyGroup })).toHaveCount(0)
    const tile = view.locator('button[aria-expanded]', { hasText: names.mixedGroup })
    await tile.click()
    const panel = page.getByTestId(`lagebild-panel-${mixedGroupId}`)
    await expect(panel.getByText(names.active)).toBeVisible()
    await expect(panel.getByText(names.ended)).toHaveCount(0)
    await expect(panel.getByText(names.notStarted)).toHaveCount(0)
  })

  test('API v1 liefert nur den aktiven Dienst', async ({ request }) => {
    const services = (await (await request.get('/api/v1/services')).json()).data as Array<{ name: string }>
    const listed = services.map((service) => service.name)
    expect(listed).toContain(names.active)
    expect(listed).not.toContain(names.ended)
    expect(listed).not.toContain(names.notStarted)
    expect(listed).not.toContain(names.onlyEnded)

    const status = (await (await request.get('/api/v1/status')).json()).data as { serviceGroups: Array<{ name: string; services: Array<{ name: string }> }> }
    expect(status.serviceGroups.map((group) => group.name)).toContain(names.mixedGroup)
    expect(status.serviceGroups.map((group) => group.name)).not.toContain(names.emptyGroup)
    expect(status.serviceGroups.flatMap((group) => group.services.map((service) => service.name))).not.toContain(names.ended)
  })
})
