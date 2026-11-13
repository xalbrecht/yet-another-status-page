import { test, expect, type APIRequestContext } from '@playwright/test'

/**
 * Mailversand des Berichts über `POST /api/availability-report/send`. Die E2E-Umgebung hat keinen Mailserver und erlaubt
 * das Schreiben der E-Mail-Einstellungen nicht (SMTP-Passwort). Geprüft werden Zugriff, Eingaben und die Fehlerantworten
 * vor dem Versand, solange keine Empfänger eingetragen sind. Der Fall „kein SMTP“ und der Versand selbst sind von Hand
 * geprüft (Auffangserver) und in den Unit-Tests (`report-mail.test.ts`) abgedeckt.
 */
test.setTimeout(120_000)

const currentMonth = () => new Date().toISOString().slice(0, 7)
const send = (request: APIRequestContext, query: string) => request.post(`/api/availability-report/send?${query}`, { timeout: 100_000 })

test.describe('Verfügbarkeitsbericht (Mailversand)', () => {
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
    expect((await response.json()).code).toBe('invalid-period')
  })

  test('resume und plan gehören zusammen, nur eines von beiden ergibt 400', async ({ request }) => {
    for (const query of ['resume=2', 'plan=abc', 'resume=0&plan=abc', 'resume=x&plan=abc']) {
      const response = await send(request, `period=${currentMonth()}&${query}`)
      expect(response.status(), query).toBe(400)
      expect((await response.json()).code, query).toBe('bad-request')
    }
  })

  // Läuft nur gegen einen Server mit PAYLOAD_PUBLIC_ALLOW_WRITES=false (E2E_ACCESS_LOCKED=1), sonst ist die Route offen.
  test('anonyme Anfrage wird mit Status 401 abgewiesen', async ({ request }) => {
    test.skip(process.env.E2E_ACCESS_LOCKED !== '1', 'Server läuft mit offenen Schreibrechten')
    const response = await send(request, `period=${currentMonth()}`)
    expect(response.status()).toBe(401)
  })
})
