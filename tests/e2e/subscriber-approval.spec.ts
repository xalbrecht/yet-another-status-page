import { test, expect, type APIRequestContext } from '@playwright/test'

/**
 * Subscriber approval and address confirmation
 *
 * Email subscribers receive notifications only when they are active, approved by the operator
 * (`verified`) and have confirmed their address (`addressConfirmed`). The recipient count
 * (`/api/subscribers/count`), the estimate on draft notifications and the real dispatch use the
 * same filter (`src/lib/subscriber-filter.ts`), so the count is used here to measure who is reached.
 *
 * The test environment has no SMTP server, so the mails themselves are not covered.
 * The environment is English, the checks accept both languages.
 */
test.describe.configure({ mode: 'serial' })

const stamp = Date.now()

async function createSubscriber(
  request: APIRequestContext,
  name: string,
  data: Record<string, unknown>,
) {
  const response = await request.post('/api/subscribers', {
    data: { type: 'email', email: `${name}-${stamp}@example.test`, active: true, ...data },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  return (await response.json()).doc as { id: number; verificationToken?: string | null }
}

async function recipientCount(request: APIRequestContext) {
  const response = await request.get('/api/subscribers/count?channel=email')
  expect(response.ok()).toBeTruthy()
  return (await response.json()).count as number
}

test.describe('Subscriber approval and confirmation', () => {
  let baseline: number

  test.beforeAll(async ({ request }) => {
    baseline = await recipientCount(request)
  })

  test('new, unapproved and unconfirmed subscriber is not counted', async ({ request }) => {
    await createSubscriber(request, 'neu', { verified: false, addressConfirmed: false })
    expect(await recipientCount(request)).toBe(baseline)
  })

  test('approved but address not confirmed is not counted', async ({ request }) => {
    await createSubscriber(request, 'freigegeben', { verified: true, addressConfirmed: false })
    expect(await recipientCount(request)).toBe(baseline)
  })

  test('address confirmed but not approved is not counted', async ({ request }) => {
    await createSubscriber(request, 'bestaetigt', { verified: false, addressConfirmed: true })
    expect(await recipientCount(request)).toBe(baseline)
  })

  test('inactive subscriber is not counted', async ({ request }) => {
    await createSubscriber(request, 'inaktiv', { verified: true, addressConfirmed: true, active: false })
    expect(await recipientCount(request)).toBe(baseline)
  })

  test('approved, confirmed and active subscriber is counted', async ({ request }) => {
    await createSubscriber(request, 'komplett', { verified: true, addressConfirmed: true })
    expect(await recipientCount(request)).toBe(baseline + 1)
  })

  test('confirmation link works once and keeps the subscriber out until approval', async ({ request }) => {
    const subscriber = await createSubscriber(request, 'link', { verified: false })
    expect(subscriber.verificationToken).toBeTruthy()
    const token = subscriber.verificationToken as string

    const first = await request.post('/api/subscribe/confirm', { data: { token } })
    expect(first.status()).toBe(200)
    expect(await first.json()).toMatchObject({ success: true, approved: false })

    const stored = await (await request.get(`/api/subscribers/${subscriber.id}`)).json()
    expect(stored.addressConfirmed).toBe(true)
    expect(stored.verificationToken).toBeNull()
    // confirmed but not approved: still not counted
    expect(await recipientCount(request)).toBe(baseline + 1)

    const second = await request.post('/api/subscribe/confirm', { data: { token } })
    expect(second.status()).toBe(404)
  })

  test('confirmation of an approved subscriber adds it to the recipients', async ({ request }) => {
    const subscriber = await createSubscriber(request, 'link-freigegeben', { verified: true })
    const response = await request.post('/api/subscribe/confirm', {
      data: { token: subscriber.verificationToken },
    })
    expect(await response.json()).toMatchObject({ success: true, approved: true })
    expect(await recipientCount(request)).toBe(baseline + 2)
  })

  test('invalid or missing token is rejected', async ({ request }) => {
    const unknown = await request.post('/api/subscribe/confirm', { data: { token: 'x'.repeat(24) } })
    expect(unknown.status()).toBe(404)
    const missing = await request.post('/api/subscribe/confirm', { data: {} })
    expect(missing.status()).toBe(400)
  })

  test('SMS subscription is rejected', async ({ request }) => {
    const response = await request.post('/api/subscribe', { data: { type: 'sms', phone: '+4915112345678' } })
    expect(response.status()).toBe(503)
  })

  test('confirmation page asks for a click before it confirms', async ({ page, request }) => {
    const subscriber = await createSubscriber(request, 'seite', { verified: false })
    await page.goto(`/confirm/${subscriber.verificationToken}`)
    await expect(page.getByRole('button', { name: /^(Confirm|Bestätigen)$/ })).toBeVisible()

    // opening the page alone confirms nothing
    const before = await (await request.get(`/api/subscribers/${subscriber.id}`)).json()
    expect(before.addressConfirmed).toBe(false)

    await page.getByRole('button', { name: /^(Confirm|Bestätigen)$/ }).click()
    await expect(page.getByRole('heading', { name: /Address confirmed|Adresse bestätigt/ })).toBeVisible({ timeout: 30_000 })

    await page.goto(`/confirm/${subscriber.verificationToken}`)
    await expect(page.getByRole('heading', { name: /Invalid confirmation link|Ungültiger Bestätigungslink/ })).toBeVisible()
  })

  test('confirmation page shows an error for an unknown token', async ({ page }) => {
    await page.goto(`/confirm/${'y'.repeat(24)}`)
    await expect(page.getByRole('heading', { name: /Invalid confirmation link|Ungültiger Bestätigungslink/ })).toBeVisible()
  })
})
