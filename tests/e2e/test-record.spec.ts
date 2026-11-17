import { test, expect, type APIRequestContext } from '@playwright/test'

/**
 * Kennzeichen „Testdatensatz“ (`isTest`) an Abonnenten. Es ist nur eine Markierung: Ohne Angabe (so legt die
 * öffentliche Anmeldung an) steht es auf „aus“, die Abfrage `where[isTest][equals]=false` schließt markierte Zeilen
 * aus, und die Markierung ändert den Empfängerkreis nicht.
 */
test.describe.configure({ mode: 'serial' })

const stamp = Date.now()

async function create(request: APIRequestContext, name: string, data: Record<string, unknown> = {}) {
  const response = await request.post('/api/subscribers', {
    data: { type: 'email', email: `${name}-${stamp}@example.test`, active: true, verified: true, addressConfirmed: true, ...data },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  return (await response.json()).doc as { id: number; isTest?: boolean | null }
}

async function count(request: APIRequestContext) {
  const response = await request.get('/api/subscribers/count?channel=email')
  expect(response.ok()).toBeTruthy()
  return (await response.json()).count as number
}

test.describe('Kennzeichen Testdatensatz', () => {
  test('ohne Angabe steht es auf „aus“, mit Angabe auf „an“, und es filtert', async ({ request }) => {
    const plain = await create(request, 'ohne-kennzeichen')
    const marked = await create(request, 'testadresse', { isTest: true })
    expect(plain.isTest).toBe(false)
    expect(marked.isTest).toBe(true)

    const query = `/api/subscribers?where[email][like]=-${stamp}@example.test&limit=50`
    const notTest = await (await request.get(`${query}&where[isTest][equals]=false`)).json()
    const onlyTest = await (await request.get(`${query}&where[isTest][equals]=true`)).json()
    expect(notTest.docs.map((d: { id: number }) => d.id)).toEqual([plain.id])
    expect(onlyTest.docs.map((d: { id: number }) => d.id)).toEqual([marked.id])
  })

  test('die Markierung ändert den Empfängerkreis nicht und lässt sich zurücknehmen', async ({ request }) => {
    const before = await count(request)
    const record = await create(request, 'empfaenger', { isTest: true })
    expect(await count(request)).toBe(before + 1)

    const update = await request.patch(`/api/subscribers/${record.id}`, { data: { isTest: false } })
    expect(update.ok(), await update.text()).toBeTruthy()
    expect((await update.json()).doc.isTest).toBe(false)
    expect(await count(request)).toBe(before + 1)
  })
})
