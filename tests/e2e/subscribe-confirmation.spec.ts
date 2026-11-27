import { test, expect, type APIRequestContext } from '@playwright/test'

/**
 * Anmeldedialog (#291): Die Bestätigung bleibt offen, bis der Leser sie schließt, und nennt die Bestätigungsmail
 * und die Freigabe durch den Betreiber. Früher schloss sich der Dialog nach 2 Sekunden von selbst.
 */
test.describe.configure({ mode: 'serial' })

test.describe('Anmeldedialog: Bestätigung', { tag: ['@public', '@abonnenten'] }, () => {
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

  test('die Bestätigung nennt Mail und Freigabe, bleibt offen und schließt mit X', async ({ page }) => {
    const address = `bestaetigung-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
    await page.goto('/')
    await page.getByRole('button', { name: /Subscribe/i }).click()
    await page.getByLabel('Email Address').fill(address)
    await page.getByRole('button', { name: /^Subscribe$/ }).last().click()

    const message = page.getByText(/confirmation email is on its way/)
    await expect(message).toBeVisible()
    await expect(message).toContainText(address)
    await expect(message).toContainText('click the link in the email')
    await expect(message).toContainText('operator has approved')

    // Früher schloss ein Zeitgeber den Dialog nach 2 Sekunden
    await page.waitForTimeout(3500)
    await expect(message).toBeVisible()

    await page.getByRole('button', { name: 'Close dialog' }).click()
    await expect(message).toBeHidden()
  })
})
