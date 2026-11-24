import { test, expect, type APIRequestContext, type PlaywrightWorkerArgs } from '@playwright/test'
import { ADMIN_STORAGE_STATE } from '../utils/admin-auth'

/**
 * Rollen der Benutzer (Issue #259). Die Tests laufen als Admin (storageState aus `global-setup.ts`) und legen eigene
 * Benutzer an, die sie am Ende wieder löschen.
 */
// Payload nimmt das Cookie nur an, wenn die Anfrage einen Origin der erlaubten Adresse (SERVER_URL) trägt.
const ORIGIN = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
test.use({ storageState: ADMIN_STORAGE_STATE, extraHTTPHeaders: { Origin: ORIGIN } })

const PASSWORD = 'e2e-rollen-Passwort-1'
const unique = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`

async function createUser(request: APIRequestContext, data: Record<string, unknown> = {}) {
  const response = await request.post('/api/users', { data: { email: `rolle-${unique()}@example.com`, password: PASSWORD, ...data } })
  expect(response.status()).toBe(201)
  return (await response.json()).doc as { id: number; roles?: string[] | null }
}

async function getMe(request: APIRequestContext) {
  const response = await request.get('/api/users/me')
  expect(response.status()).toBe(200)
  return (await response.json()).user as { id: number; roles?: string[] | null }
}

test('der Testbenutzer der Umgebung hat die Rolle admin', { tag: ['@admin', '@system'] }, async ({ request }) => {
  expect((await getMe(request)).roles).toEqual(['admin'])
})

test('ein neuer Benutzer ohne Angabe hat keine Rolle', { tag: ['@admin', '@system'] }, async ({ request }) => {
  const user = await createUser(request)
  try {
    expect(user.roles ?? []).toEqual([])
  } finally {
    await request.delete(`/api/users/${user.id}`)
  }
})

test('mehrere Rollen und Gruppen werden gespeichert', { tag: ['@admin', '@system'] }, async ({ request }) => {
  const user = await createUser(request, { roles: ['servicedesk', 'produktmanager'], servicedeskAlleGruppen: true })
  try {
    const stored = (await (await request.get(`/api/users/${user.id}`)).json()) as { roles: string[]; servicedeskAlleGruppen: boolean }
    expect([...stored.roles].sort()).toEqual(['produktmanager', 'servicedesk'])
    expect(stored.servicedeskAlleGruppen).toBe(true)
  } finally {
    await request.delete(`/api/users/${user.id}`)
  }
})

test('ein weiterer Admin lässt sich löschen, solange ein anderer Admin bleibt', { tag: ['@admin', '@system'] }, async ({ request }) => {
  const second = await createUser(request, { roles: ['admin'] })
  const response = await request.delete(`/api/users/${second.id}`)
  expect(response.status()).toBe(200)
})

test('der letzte Admin lässt sich nicht löschen und verliert die Rolle nicht', { tag: ['@admin', '@system'] }, async ({ request }) => {
  // Nur in einer Umgebung mit genau einem Admin (Wegwerf-Datenbank), nie gegen echte Benutzer.
  const me = await getMe(request)
  const others = (await (await request.get(`/api/users?where[roles][equals]=admin&where[id][not_equals]=${me.id}&limit=1`)).json()).docs as unknown[]
  test.skip(others.length > 0, 'Die Umgebung hat weitere Admins')

  const del = await request.delete(`/api/users/${me.id}`)
  expect(del.status()).toBeGreaterThanOrEqual(400)
  const demote = await request.patch(`/api/users/${me.id}`, { data: { roles: ['servicedesk'] } })
  expect(demote.status()).toBeGreaterThanOrEqual(400)
  expect((await getMe(request)).roles).toEqual(['admin'])
})

/** Meldet einen Benutzer mit Kennwort an und liefert einen Client mit seiner Sitzung (ohne die Admin-Sitzung). */
async function loginAs(playwright: PlaywrightWorkerArgs['playwright'], email: string) {
  const client = await playwright.request.newContext({ baseURL: ORIGIN, extraHTTPHeaders: { Origin: ORIGIN } })
  const response = await client.post('/api/users/login', { data: { email, password: PASSWORD } })
  expect(response.status()).toBe(200)
  return client
}

test.describe('Benutzer ohne Admin-Rolle', () => {
  test('ändert Rollen nicht, auch nicht die eigenen', { tag: ['@admin', '@system'] }, async ({ request, playwright }) => {
    const email = `rolle-${unique()}@example.com`
    const user = await createUser(request, { email })
    const client = await loginAs(playwright, email)
    try {
      const escalate = await client.patch(`/api/users/${user.id}`, { data: { roles: ['admin'] } })
      expect(escalate.status()).toBe(200) // Anfrage zulässig, das Rollenfeld wird verworfen
      const stored = (await (await request.get(`/api/users/${user.id}`)).json()) as { roles?: string[] | null }
      expect(stored.roles ?? []).toEqual([])
      const scope = await client.patch(`/api/users/${user.id}`, { data: { servicedeskAlleGruppen: true } })
      expect(scope.status()).toBe(200)
      const stored2 = (await (await request.get(`/api/users/${user.id}`)).json()) as { servicedeskAlleGruppen?: boolean }
      expect(stored2.servicedeskAlleGruppen).toBe(false)
    } finally {
      await client.dispose()
      await request.delete(`/api/users/${user.id}`)
    }
  })

  test('legt keine Benutzer an und löscht keine', { tag: ['@admin', '@system'] }, async ({ request, playwright }) => {
    const email = `rolle-${unique()}@example.com`
    const user = await createUser(request, { email })
    const other = await createUser(request)
    const client = await loginAs(playwright, email)
    try {
      const create = await client.post('/api/users', { data: { email: `neu-${unique()}@example.com`, password: PASSWORD, roles: ['admin'] } })
      expect(create.status()).toBeGreaterThanOrEqual(400)
      const del = await client.delete(`/api/users/${other.id}`)
      expect(del.status()).toBeGreaterThanOrEqual(400)
      expect((await request.get(`/api/users/${other.id}`)).status()).toBe(200)
    } finally {
      await client.dispose()
      await request.delete(`/api/users/${user.id}`)
      await request.delete(`/api/users/${other.id}`)
    }
  })

  test('sieht nur den eigenen Datensatz und ändert ihn (ohne Rollenfelder)', { tag: ['@admin', '@system'] }, async ({ request, playwright }) => {
    const email = `rolle-${unique()}@example.com`
    const user = await createUser(request, { email })
    const other = await createUser(request)
    const client = await loginAs(playwright, email)
    try {
      const list = (await (await client.get('/api/users?limit=100')).json()) as { totalDocs: number; docs: Array<{ id: number }> }
      expect(list.docs.map((doc) => doc.id)).toEqual([user.id])
      const rename = await client.patch(`/api/users/${user.id}`, { data: { name: 'Neuer Name' } })
      expect(rename.status()).toBe(200)
      const foreign = await client.patch(`/api/users/${other.id}`, { data: { name: 'Fremd' } })
      expect(foreign.status()).toBeGreaterThanOrEqual(400)
    } finally {
      await client.dispose()
      await request.delete(`/api/users/${user.id}`)
      await request.delete(`/api/users/${other.id}`)
    }
  })
})
