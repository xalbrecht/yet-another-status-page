import { test, expect, type APIRequestContext } from '@playwright/test'

/**
 * Erneute Anmeldung nach der Abmeldung (#255)
 *
 * Die Abmeldung setzt nur `active = false`, der Datensatz bleibt. Eine erneute Anmeldung mit derselben
 * Adresse oder Nummer aktiviert ihn wieder und setzt Freigabe und Bestätigung zurück. Ein aktiver Eintrag
 * bleibt ein Fall für 409.
 *
 * Die Testumgebung hat weder SMTP-Server noch SMS-Konto. Der Test schaltet beides vorübergehend ein (ein
 * SMTP-Server auf Port 1 ist nicht erreichbar, der Mailversand scheitert und wird protokolliert) und
 * stellt es danach wieder aus.
 */
test.describe.configure({ mode: 'serial' })

const stamp = Date.now()

// Eigene Absenderadresse: Die Ratenbegrenzung (5 Anmeldungen je Adresse und Stunde) zählt sonst im selben Topf wie
// andere Tests und wie wiederholte lokale Läufe
const clientIp = `198.51.100.${(stamp % 250) + 1}`
const headers = { 'x-forwarded-for': clientIp }

type Subscriber = {
  id: number
  active: boolean
  verified: boolean
  addressConfirmed?: boolean
  verificationToken?: string
  unsubscribeToken?: string
}

async function setGlobal(request: APIRequestContext, slug: string, data: Record<string, unknown>) {
  const response = await request.post(`/api/globals/${slug}`, { data })
  expect(response.ok(), await response.text()).toBeTruthy()
}

async function findByField(request: APIRequestContext, field: string, value: string): Promise<Subscriber> {
  const response = await request.get(`/api/subscribers?where[${field}][equals]=${encodeURIComponent(value)}&depth=0&limit=2`)
  expect(response.ok()).toBeTruthy()
  const docs = (await response.json()).docs as Subscriber[]
  expect(docs).toHaveLength(1)
  return docs[0]
}

async function patch(request: APIRequestContext, id: number, data: Record<string, unknown>) {
  const response = await request.patch(`/api/subscribers/${id}`, { data })
  expect(response.ok(), await response.text()).toBeTruthy()
}

test.describe('Erneute Anmeldung nach der Abmeldung', { tag: ['@public', '@abonnenten'] }, () => {
  test.beforeAll(async ({ request }) => {
    await setGlobal(request, 'email-settings', { enabled: true, smtpHost: 'localhost', smtpPort: 1, smtpFromAddress: 'status@example.test' })
    await setGlobal(request, 'sms-settings', { enabled: true, twilioAccountSid: 'ACtest', twilioAuthToken: 'token', twilioFromNumber: '+15005550006' })
  })

  test.afterAll(async ({ request }) => {
    await setGlobal(request, 'email-settings', { enabled: false })
    await setGlobal(request, 'sms-settings', { enabled: false })
  })

  test('E-Mail: Abgemeldete melden sich erneut an, Freigabe und Bestätigung fallen zurück', async ({ request }) => {
    const email = `erneut-${stamp}@example.test`
    const subscribe = () => request.post('/api/subscribe', { data: { type: 'email', email }, headers })

    expect((await subscribe()).status()).toBe(200)
    const first = await findByField(request, 'email', email)
    await patch(request, first.id, { verified: true, addressConfirmed: true })
    const before = await findByField(request, 'email', email)
    expect(before.verificationToken).toBeTruthy()

    // Ein aktiver Eintrag bleibt ein Fall für 409
    expect((await subscribe()).status()).toBe(409)

    const unsubscribe = await request.post(`/api/unsubscribe/${before.unsubscribeToken}`, { form: { 'List-Unsubscribe': 'One-Click' } })
    expect(unsubscribe.status()).toBe(200)
    expect((await findByField(request, 'email', email)).active).toBe(false)

    expect((await subscribe()).status()).toBe(200)
    const after = await findByField(request, 'email', email)
    expect(after.id).toBe(first.id)
    expect(after.active).toBe(true)
    expect(after.verified).toBe(false)
    expect(after.addressConfirmed).toBe(false)
    expect(after.verificationToken).toBeTruthy()
    expect(after.verificationToken).not.toBe(before.verificationToken)
    // Alte Abmeldelinks in früheren Mails gelten weiter
    expect(after.unsubscribeToken).toBe(before.unsubscribeToken)

    expect((await subscribe()).status()).toBe(409)
  })

  test('SMS: Abgemeldete melden sich erneut an, die Freigabe fällt zurück', async ({ request }) => {
    const phone = `+4915${String(stamp).slice(-9)}`
    const subscribe = () => request.post('/api/subscribe', { data: { type: 'sms', phone }, headers })

    expect((await subscribe()).status()).toBe(200)
    const first = await findByField(request, 'phone', phone)
    await patch(request, first.id, { verified: true })
    expect((await subscribe()).status()).toBe(409)

    await patch(request, first.id, { active: false })
    expect((await subscribe()).status()).toBe(200)
    const after = await findByField(request, 'phone', phone)
    expect(after.id).toBe(first.id)
    expect(after.active).toBe(true)
    expect(after.verified).toBe(false)

    expect((await subscribe()).status()).toBe(409)
  })
})
