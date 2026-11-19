import { test, expect } from '@playwright/test'
import { createMaintenance, createService, createServiceGroup, updateService } from '../utils/payload-helpers'

/**
 * Wartungsleiste (Issue #217): Unter dem Statusbanner steht eine zweite, blaue Leiste, solange ein angezeigter Dienst in
 * einer laufenden Wartung steht. Sie zählt die Dienste mit und ohne erwartete Einschränkung. Das Banner bleibt unverändert.
 * Die Testdaten sind geteilt, deshalb prüfen die Tests Texte und Zeilen, keine Gesamtzahlen (die decken die Unit-Tests ab).
 * Die Testumgebung läuft auf Englisch.
 */
const HOUR = 3600_000
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString()

async function setup(label: string) {
  const id = Date.now()
  const group = await createServiceGroup({ name: `Leiste ${label} ${id}`, icon: 'Server' })
  const service = await createService({ name: `Leistendienst ${label} ${id}`, group: group.id })
  return { service }
}

const running = (serviceId: number, affectsService: boolean) =>
  createMaintenance({
    title: `Leiste ${Date.now()}`,
    status: 'in_progress',
    scheduledStartAt: iso(-HOUR),
    scheduledEndAt: iso(HOUR),
    affectedServices: [serviceId],
    affectsService,
  })

test.describe('Wartungsleiste', { tag: ['@public', '@wartungen'] }, () => {
  test('laufende Wartung mit Auswirkung: Leiste nennt Einschränkungen, Marke den Zusatz', async ({ page }) => {
    const { service } = await setup('mit')
    await running(service.id, true)

    await page.goto('/')
    await expect(page.getByTestId('maintenance-bar')).toContainText('Maintenance in progress')
    await expect(page.getByTestId('maintenance-bar')).toContainText(/with expected restrictions/)
    const row = page.getByTestId('service-row').filter({ hasText: service.name })
    await expect(row.getByTestId('service-maintenance')).toContainText(/Maintenance until .*, restricted availability/)
  })

  test('laufende Wartung ohne Auswirkung: Leiste zählt den Dienst ohne Einschränkung, Marke ohne Zusatz', async ({ page }) => {
    const { service } = await setup('ohne')
    await running(service.id, false)

    await page.goto('/')
    await expect(page.getByTestId('maintenance-bar')).toContainText(/without restrictions/)
    const row = page.getByTestId('service-row').filter({ hasText: service.name })
    await expect(row.getByTestId('service-maintenance')).toContainText(/Maintenance until/)
    await expect(row.getByTestId('service-maintenance')).not.toContainText('restricted availability')
  })

  test('bevorstehende Wartung zeigt am Dienst keinen Zusatz „restricted availability“', async ({ page }) => {
    const { service } = await setup('bald')
    await createMaintenance({
      title: `Bald ${Date.now()}`,
      status: 'upcoming',
      scheduledStartAt: iso(2 * HOUR),
      scheduledEndAt: iso(4 * HOUR),
      affectedServices: [service.id],
      affectsService: true,
    })

    await page.goto('/')
    const row = page.getByTestId('service-row').filter({ hasText: service.name })
    await expect(row.getByTestId('service-maintenance')).not.toContainText('restricted availability')
  })

  test('Wartung mit Auswirkung und Störung: Banner zeigt die Störung, Leiste bleibt sichtbar', async ({ page }) => {
    const { service } = await setup('stoerung')
    await updateService(service.id, { status: 'partial' })
    await running(service.id, true)

    await page.goto('/')
    await expect(page.getByTestId('maintenance-bar')).toBeVisible()
    await expect(page.getByText('Some systems are experiencing partial outages')).toBeVisible()
  })
})
