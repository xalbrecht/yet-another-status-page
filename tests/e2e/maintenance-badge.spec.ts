import { test, expect } from '@playwright/test'
import { createMaintenance, createService, createServiceGroup, updateService } from '../utils/payload-helpers'

/**
 * Wartung am Dienst: Neben dem Zustandspunkt zeigt die Statusseite eine laufende oder bald beginnende Wartung.
 * Die Anzeige kommt aus den erfassten Wartungen, nicht aus dem Zustand „Wartung“ am Dienst.
 * Die Testumgebung läuft auf Englisch („Maintenance until …“).
 */
const HOUR = 3600_000
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString()

async function setup(label: string) {
  const id = Date.now()
  const group = await createServiceGroup({ name: `Wartung ${label} ${id}`, icon: 'Server' })
  const service = await createService({ name: `Wartungsdienst ${label} ${id}`, group: group.id })
  return { service }
}

test.describe('Wartung am Dienst', () => {
  test('laufende Wartung zeigt „Wartung bis“ neben dem Zustand einer Störung', async ({ page }) => {
    const { service } = await setup('läuft')
    await updateService(service.id, { status: 'partial' })
    await createMaintenance({
      title: `Läuft ${Date.now()}`,
      status: 'in_progress',
      scheduledStartAt: iso(-HOUR),
      scheduledEndAt: iso(HOUR),
      affectedServices: [service.id],
    })

    await page.goto('/')
    const row = page.getByTestId('service-row').filter({ hasText: service.name })
    await expect(row).toContainText('Partial Outage')
    await expect(row.getByTestId('service-maintenance')).toContainText(/Maintenance until/)
  })

  test('Wartung in den nächsten 24 Stunden zeigt Beginn und Ende', async ({ page }) => {
    const { service } = await setup('bald')
    await createMaintenance({
      title: `Bald ${Date.now()}`,
      status: 'upcoming',
      scheduledStartAt: iso(2 * HOUR),
      scheduledEndAt: iso(3 * HOUR),
      affectedServices: [service.id],
    })

    await page.goto('/')
    const row = page.getByTestId('service-row').filter({ hasText: service.name })
    await expect(row.getByTestId('service-maintenance')).toContainText(/Maintenance .+ – .+/)
    await expect(row.getByTestId('service-maintenance')).not.toContainText('until')
  })

  test('Wartung später als 24 Stunden zeigt keine Anzeige am Dienst', async ({ page }) => {
    const { service } = await setup('spaeter')
    await createMaintenance({
      title: `Später ${Date.now()}`,
      status: 'upcoming',
      scheduledStartAt: iso(48 * HOUR),
      scheduledEndAt: iso(49 * HOUR),
      affectedServices: [service.id],
    })

    await page.goto('/')
    const row = page.getByTestId('service-row').filter({ hasText: service.name })
    await expect(row).toHaveCount(1)
    await expect(row.getByTestId('service-maintenance')).toHaveCount(0)
  })

  test('abgeschlossene Wartung zeigt keine Anzeige am Dienst', async ({ page }) => {
    const { service } = await setup('fertig')
    await createMaintenance({
      title: `Fertig ${Date.now()}`,
      status: 'completed',
      scheduledStartAt: iso(-3 * HOUR),
      scheduledEndAt: iso(-2 * HOUR),
      affectedServices: [service.id],
    })

    await page.goto('/')
    const row = page.getByTestId('service-row').filter({ hasText: service.name })
    await expect(row).toHaveCount(1)
    await expect(row.getByTestId('service-maintenance')).toHaveCount(0)
  })

  test('ein Dienst ohne Wartung zeigt keine Anzeige', async ({ page }) => {
    const { service } = await setup('ohne')
    await page.goto('/')
    const row = page.getByTestId('service-row').filter({ hasText: service.name })
    await expect(row).toHaveCount(1)
    await expect(row.getByTestId('service-maintenance')).toHaveCount(0)
  })
})
