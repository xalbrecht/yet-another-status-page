import { test, expect, type APIRequestContext } from '@playwright/test'
import { createServiceGroup } from '../utils/payload-helpers'

/**
 * Anmeldedialog, Gruppenwahl (#274): Die Gruppenliste wird erst geladen, wenn „alle Dienstgruppen“ abgewählt wird.
 */
test.describe.configure({ mode: 'serial' })

test.describe('Anmeldedialog: Gruppenliste laden', { tag: ['@public', '@abonnenten'] }, () => {
  // Ohne E-Mail-Versand zeigt der Dialog „nicht verfügbar“: Der Test schaltet ihn vorübergehend ein
  const setEmail = async (request: APIRequestContext, data: Record<string, unknown>) => {
    const response = await request.post('/api/globals/email-settings', { data })
    expect(response.ok(), await response.text()).toBeTruthy()
  }
  test.beforeAll(async ({ request }) => {
    await setEmail(request, { enabled: true, smtpHost: 'localhost', smtpPort: 1, smtpFromAddress: 'status@example.test' })
  })
  test.afterAll(async ({ request }) => {
    await setEmail(request, { enabled: false })
  })

  test('die Liste wird erst beim Abwählen von „alle Dienstgruppen“ angefragt', async ({ page }) => {
    const name = `Dialog Gruppe ${Date.now()}`
    await createServiceGroup({ name, icon: 'Server' })
    const requests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/api/service-groups')) requests.push(request.url())
    })

    await page.goto('/')
    await page.getByRole('button', { name: /Subscribe/i }).click()
    const all = page.getByLabel('All service groups')
    await expect(all).toBeChecked()
    // Dem Dialog Zeit geben, andere Anfragen abzuschließen: erst danach gilt „keine Anfrage“
    await page.waitForLoadState('networkidle')
    expect(requests).toEqual([])

    await all.uncheck()
    await expect(page.getByLabel(name)).toBeVisible()
    expect(requests).toHaveLength(1)
  })

  test('die Erfolgsmeldung nennt „alle Dienstgruppen“ oder die Zahl der gewählten Gruppen', async ({ page }) => {
    const name = `Dialog Meldung ${Date.now()}`
    await createServiceGroup({ name, icon: 'Server' })
    for (const [pick, expected] of [[false, 'Service groups: all'], [true, 'Service groups: 1 selected']] as const) {
      await page.goto('/')
      await page.getByRole('button', { name: /Subscribe/i }).click()
      await page.getByLabel('Email Address').fill(`dialog-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`)
      if (pick) {
        await page.getByLabel('All service groups').uncheck()
        await page.getByLabel(name).check()
      }
      await page.getByRole('button', { name: /^Subscribe$/ }).last().click()
      await expect(page.getByText(expected)).toBeVisible()
    }
  })
})
