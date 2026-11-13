import { test, expect, type APIRequestContext } from '@playwright/test'

/**
 * Mailversand des Berichts über `POST /api/availability-report/send`. Die E2E-Umgebung hat keinen Mailserver, geprüft
 * werden Zugriff, Eingaben und die Fehlerantworten vor dem ersten Versand. Der Versand selbst ist in den Unit-Tests
 * (`report-mail.test.ts`) und von Hand mit dem Auffangserver geprüft.
 */
test.describe.configure({ mode: 'serial' })
test.setTimeout(120_000)

const currentMonth = () => new Date().toISOString().slice(0, 7)
const send = (request: APIRequestContext, query: string) => request.post(`/api/availability-report/send?${query}`, { timeout: 100_000 })

async function setEmailSettings(request: APIRequestContext, data: Record<string, unknown>) {
  const response = await request.post('/api/globals/email-settings', { data })
  expect(response.ok(), await response.text()).toBe(true)
}

test.describe('Verfügbarkeitsbericht (Mailversand)', () => {
  test.beforeEach(async ({ request }) => {
    await setEmailSettings(request, { reportRecipients: '', smtpHost: '', smtpFromAddress: '' })
  })
  test.afterAll(async ({ request }) => {
    await setEmailSettings(request, { reportRecipients: '', smtpHost: '', smtpFromAddress: '' })
  })

  test('GET ist nicht erlaubt (405)', async ({ request }) => {
    expect((await request.get(`/api/availability-report/send?period=${currentMonth()}`)).status()).toBe(405)
  })

  test('ohne Empfänger ergibt der Versand 400 mit dem Code no-recipients', async ({ request }) => {
    const response = await send(request, `period=${currentMonth()}`)
    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.code).toBe('no-recipients')
    expect(body.error).toMatch(/Empfänger|recipients/i)
  })

  test('Empfänger aus dem Query-String werden ignoriert', async ({ request }) => {
    const response = await send(request, `period=${currentMonth()}&to=x@y.de&recipients=x@y.de`)
    expect(response.status()).toBe(400)
    expect((await response.json()).code).toBe('no-recipients')
  })

  test('ein ungültiger Zeitraum ergibt 400', async ({ request }) => {
    const response = await send(request, 'period=2026-13')
    expect(response.status()).toBe(400)
    expect(typeof (await response.json()).error).toBe('string')
  })

  test('mit Empfängern, aber ohne SMTP ergibt der Versand 400 mit dem Code no-smtp', async ({ request }) => {
    await setEmailSettings(request, { reportRecipients: 'a@example.de' })
    const response = await send(request, `period=${currentMonth()}`)
    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.code).toBe('no-smtp')
    expect(body.error).toMatch(/SMTP/)
  })

  test('resume und plan gehören zusammen, nur eines von beiden ergibt 400', async ({ request }) => {
    await setEmailSettings(request, { reportRecipients: 'a@example.de' })
    for (const query of ['resume=2', 'plan=abc', 'resume=0&plan=abc', 'resume=x&plan=abc']) {
      const response = await send(request, `period=${currentMonth()}&${query}`)
      expect(response.status(), query).toBe(400)
      expect((await response.json()).code, query).toBe('bad-request')
    }
  })

  test('resume mit Kennung wird erst nach der SMTP-Prüfung verglichen', async ({ request }) => {
    await setEmailSettings(request, { reportRecipients: 'a@example.de' })
    const response = await send(request, `period=${currentMonth()}&resume=2&plan=falsch`)
    expect(response.status()).toBe(400)
    expect((await response.json()).code).toBe('no-smtp')
  })

  // Läuft nur gegen einen Server mit PAYLOAD_PUBLIC_ALLOW_WRITES=false (E2E_ACCESS_LOCKED=1), sonst ist die Route offen.
  test('anonyme Anfrage wird mit Status 401 abgewiesen', async ({ request }) => {
    test.skip(process.env.E2E_ACCESS_LOCKED !== '1', 'Server läuft mit offenen Schreibrechten')
    const response = await send(request, `period=${currentMonth()}`)
    expect(response.status()).toBe(401)
  })
})
