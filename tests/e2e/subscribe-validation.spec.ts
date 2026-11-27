import { test, expect, type APIRequestContext } from '@playwright/test'

/**
 * Anmeldedialog (#290): Bei einer ungültigen Adresse erscheint die eigene Meldung, nicht die Sprechblase des Browsers.
 * Die Sprechblase ist kein Teil der Seite. Der Test belegt das Fehlen indirekt: Hält der Browser das Absenden an,
 * läuft die eigene Prüfung nie und die Meldung der Seite erscheint nicht. Mit `noValidate` am Formular erscheint sie.
 */
test.describe.configure({ mode: 'serial' })

test.describe('Anmeldedialog: ungültige E-Mail-Adresse', { tag: ['@public', '@abonnenten'] }, () => {
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

  test('„abc“ zeigt die eigene Meldung der Seite', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Subscribe/i }).click()
    const email = page.getByLabel('Email Address')
    await email.fill('abc')
    // Voraussetzung: Der Browser hält die Eingabe selbst für ungültig, sonst prüfte der Test nichts
    expect(await email.evaluate((input: HTMLInputElement) => input.validity.typeMismatch)).toBe(true)

    await page.getByRole('button', { name: /^Subscribe$/ }).last().click()
    await expect(page.getByText('Please enter a valid email address')).toBeVisible()
  })
})
