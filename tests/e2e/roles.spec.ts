import { test, expect, type APIRequestContext, type PlaywrightWorkerArgs } from '@playwright/test'
import { ADMIN_STORAGE_STATE } from '../utils/admin-auth'
import { createService, createServiceGroup } from '../utils/payload-helpers'

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

const denied = (response: { status(): number }) => {
  expect(response.status()).toBeGreaterThanOrEqual(400)
  expect(response.status()).toBeLessThan(500)
}

test.describe.serial('Sammlungen nach Rolle und Dienstgruppe', () => {
  type Client = APIRequestContext
  const data = {} as {
    admin: Client
    desk: Client
    deskAll: Client
    pm: Client
    none: Client
    groupA: number
    groupB: number
    svcA: number
    svcB: number
    incA: number
    incMix: number
    incB: number
    deskId: number
  }
  const clients: Client[] = []

  const incidentBody = (title: string, services: number[]) => ({
    title,
    impact: 'partial',
    affectedServices: services,
    updates: [{ status: 'investigating', message: 'Text' }],
  })
  const maintenanceBody = (title: string, services: number[]) => ({
    title,
    maintenanceKind: 'sla',
    status: 'upcoming',
    scheduledStartAt: new Date(Date.now() + 86400000).toISOString(),
    scheduledEndAt: new Date(Date.now() + 90000000).toISOString(),
    affectedServices: services,
  })
  const createIncident = async (client: Client, title: string, services: number[]) => client.post('/api/incidents', { data: incidentBody(title, services) })

  test.beforeAll(async ({ playwright }) => {
    const admin = await playwright.request.newContext({ baseURL: ORIGIN, extraHTTPHeaders: { Origin: ORIGIN }, storageState: ADMIN_STORAGE_STATE })
    clients.push(admin)
    data.admin = admin
    const id = unique()
    const groupA = await createServiceGroup({ name: `Rollen A ${id}`, icon: 'Server' })
    const groupB = await createServiceGroup({ name: `Rollen B ${id}`, icon: 'Server' })
    const startsAt = new Date(Date.now() - 5 * 86400000).toISOString()
    const svcA = await createService({ name: `Rollen DA ${id}`, group: groupA.id, startsAt })
    const svcB = await createService({ name: `Rollen DB ${id}`, group: groupB.id, startsAt })
    Object.assign(data, { groupA: groupA.id, groupB: groupB.id, svcA: svcA.id, svcB: svcB.id })
    const make = async (extra: Record<string, unknown>) => {
      const email = `rolle-${unique()}@example.com`
      const user = await createUser(admin, { email, ...extra })
      const client = await loginAs(playwright, email)
      clients.push(client)
      return { user, client }
    }
    const desk = await make({ roles: ['servicedesk'], servicedeskGruppen: [groupA.id] })
    data.desk = desk.client
    data.deskId = desk.user.id
    data.deskAll = (await make({ roles: ['servicedesk'], servicedeskAlleGruppen: true })).client
    data.pm = (await make({ roles: ['produktmanager'], produktmanagerGruppen: [groupA.id] })).client
    data.none = (await make({})).client
    const inc = async (title: string, services: number[]) => {
      const response = await createIncident(admin, `${title} ${id}`, services)
      expect(response.status()).toBe(201)
      return (await response.json()).doc.id as number
    }
    data.incA = await inc('Nur A', [svcA.id])
    data.incMix = await inc('A und B', [svcA.id, svcB.id])
    data.incB = await inc('Nur B', [svcB.id])
  })

  test.afterAll(async () => {
    for (const client of clients) await client.dispose()
  })

  test('ServiceDesk mit Gruppe A legt Meldungen nur mit Diensten der Gruppe an', { tag: ['@admin', '@stoerungen'] }, async () => {
    const ok = await createIncident(data.desk, 'Desk A', [data.svcA])
    expect(ok.status()).toBe(201)
    denied(await createIncident(data.desk, 'Desk B', [data.svcB]))
    denied(await createIncident(data.desk, 'Desk A und B', [data.svcA, data.svcB]))
    denied(await createIncident(data.desk, 'Desk ohne Dienst', []))
  })

  test('ServiceDesk mit „alle Dienstgruppen“ legt Meldungen in jeder Gruppe und ohne Dienste an', { tag: ['@admin', '@stoerungen'] }, async () => {
    expect((await createIncident(data.deskAll, 'Alle B', [data.svcB])).status()).toBe(201)
    expect((await createIncident(data.deskAll, 'Alle ohne Dienst', [])).status()).toBe(201)
  })

  test('ServiceDesk mit Gruppe A sieht nur Meldungen mit einem Dienst der Gruppe', { tag: ['@admin', '@stoerungen'] }, async () => {
    const list = (await (await data.desk.get('/api/incidents?limit=200&depth=0')).json()) as { docs: Array<{ id: number }> }
    const ids = list.docs.map((doc) => doc.id)
    expect(ids).toContain(data.incA)
    expect(ids).toContain(data.incMix)
    expect(ids).not.toContain(data.incB)
    denied(await data.desk.get(`/api/incidents/${data.incB}`))
    const graphql = await data.desk.post('/api/graphql', { data: { query: '{ Incidents(limit: 200) { docs { id } } }' } })
    const gids = ((await graphql.json()) as { data?: { Incidents?: { docs: Array<{ id: number }> } } }).data?.Incidents?.docs.map((doc) => doc.id) ?? []
    expect(gids).not.toContain(data.incB)
  })

  test('ServiceDesk ändert und löscht nur Meldungen, deren Dienste alle in der Gruppe liegen', { tag: ['@admin', '@stoerungen'] }, async () => {
    expect((await data.desk.patch(`/api/incidents/${data.incA}`, { data: { title: 'Nur A geändert' } })).status()).toBe(200)
    denied(await data.desk.patch(`/api/incidents/${data.incMix}`, { data: { title: 'Gemischt geändert' } }))
    denied(await data.desk.delete(`/api/incidents/${data.incMix}`))
    denied(await data.desk.delete(`/api/incidents/${data.incB}`))
    denied(await data.desk.patch(`/api/incidents/${data.incA}`, { data: { affectedServices: [data.svcA, data.svcB] } }))
  })

  test('Produktmanager legt Wartungen in der Gruppe an, Störungen nicht, und liest Meldungen der Gruppe', { tag: ['@admin', '@wartungen'] }, async () => {
    expect((await data.pm.post('/api/maintenances', { data: maintenanceBody('PM A', [data.svcA]) })).status()).toBe(201)
    denied(await data.pm.post('/api/maintenances', { data: maintenanceBody('PM B', [data.svcB]) }))
    denied(await createIncident(data.pm, 'PM Störung', [data.svcA]))
    const list = (await (await data.pm.get('/api/incidents?limit=200&depth=0')).json()) as { docs: Array<{ id: number }> }
    const ids = list.docs.map((doc) => doc.id)
    expect(ids).toContain(data.incA)
    expect(ids).not.toContain(data.incB)
  })

  test('Statusprotokoll: Produktmanager sieht nur Dienste seiner Gruppe, ServiceDesk nichts', { tag: ['@admin', '@statusprotokoll'] }, async () => {
    for (const service of [data.svcA, data.svcB]) {
      expect((await data.admin.patch(`/api/services/${service}`, { data: { status: 'degraded' } })).status()).toBe(200)
    }
    const events = (await (await data.pm.get('/api/service-status-events?limit=200&depth=2')).json()) as { docs: Array<{ service: { id: number; group: { id: number } | number } }> }
    expect(events.docs.length).toBeGreaterThan(0)
    for (const event of events.docs) {
      const group = event.service.group
      expect(typeof group === 'object' ? group.id : group).toBe(data.groupA)
    }
    denied(await data.desk.get('/api/service-status-events'))
  })

  test('Ohne Admin-Rolle: keine Abonnenten, keine Vorlagen für Produktmanager, keine Einstellungen, keine Dienste', { tag: ['@admin', '@system'] }, async () => {
    denied(await data.desk.get('/api/subscribers'))
    denied(await data.pm.get('/api/subscribers'))
    denied(await data.pm.get('/api/message-templates'))
    expect((await data.desk.get('/api/message-templates')).status()).toBe(200)
    denied(await data.desk.post('/api/globals/settings', { data: { siteName: 'x' } }))
    denied(await data.desk.post('/api/globals/email-settings', { data: { enabled: false } }))
    denied(await data.desk.patch(`/api/service-groups/${data.groupA}`, { data: { name: 'x' } }))
    denied(await data.desk.post('/api/services', { data: { name: 'x', group: data.groupA, startsAt: new Date().toISOString() } }))
    const email = (await (await data.desk.get('/api/globals/email-settings')).json()) as Record<string, unknown>
    expect(email.smtpHost).toBeUndefined()
  })

  test('Benutzer ohne Rolle legt nichts an', { tag: ['@admin', '@system'] }, async () => {
    denied(await createIncident(data.none, 'Ohne Rolle', [data.svcA]))
    denied(await data.none.post('/api/maintenances', { data: maintenanceBody('Ohne Rolle', [data.svcA]) }))
    denied(await data.none.get('/api/subscribers'))
  })

  test('Rollenänderung wirkt bei der nächsten Anfrage ohne neue Anmeldung', { tag: ['@admin', '@system'] }, async () => {
    expect((await data.admin.patch(`/api/users/${data.deskId}`, { data: { roles: [] } })).status()).toBe(200)
    denied(await createIncident(data.desk, 'Nach Entzug', [data.svcA]))
    expect((await data.admin.patch(`/api/users/${data.deskId}`, { data: { roles: ['servicedesk'] } })).status()).toBe(200)
    expect((await createIncident(data.desk, 'Nach Rückgabe', [data.svcA])).status()).toBe(201)
  })
})
