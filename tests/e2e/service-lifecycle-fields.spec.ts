import { test, expect } from '@playwright/test'
import { createServiceGroup } from '../utils/payload-helpers'

const API_BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const DAY = 24 * 3600 * 1000

const create = (body: Record<string, unknown>) =>
  fetch(`${API_BASE}/api/services`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

/** Beginn und Ende werden als Tag gespeichert: Tagesanfang bzw. Tagesende. */
test.describe('Beginn und Ende von Diensten', { tag: ['@admin', '@dienste'] }, () => {
  test('Beginn wird auf den Tagesanfang, Ende auf das Tagesende gerundet', async () => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Lebenszyklus Gruppe ${id}` })
    const picked = new Date(Date.UTC(2026, 2, 5, 12, 0, 0))
    const response = await create({ name: `Lebenszyklus ${id}`, slug: `lebenszyklus-${id}`, status: 'operational', group: group.id, startsAt: picked.toISOString(), endsAt: picked.toISOString() })
    expect(response.status).toBe(201)
    const { doc } = await response.json()
    const startsAt = new Date(doc.startsAt).getTime()
    const endsAt = new Date(doc.endsAt).getTime()
    expect(startsAt).toBeLessThanOrEqual(picked.getTime())
    expect(picked.getTime() - startsAt).toBeLessThan(DAY)
    // derselbe Kalendertag: das Ende liegt eine Millisekunde vor dem nächsten Tagesanfang (Sommerzeit-Tage ausgenommen)
    expect(endsAt).toBeGreaterThan(picked.getTime())
    expect(endsAt - startsAt).toBeGreaterThanOrEqual(DAY - 3600 * 1000)
    expect(endsAt - startsAt).toBeLessThanOrEqual(DAY + 3600 * 1000)
  })

  test('ohne Angabe ist der Beginn der heutige Tag', async () => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Lebenszyklus Gruppe B ${id}` })
    const response = await create({ name: `Lebenszyklus B ${id}`, slug: `lebenszyklus-b-${id}`, status: 'operational', group: group.id })
    expect(response.status).toBe(201)
    const { doc } = await response.json()
    const startsAt = new Date(doc.startsAt).getTime()
    expect(startsAt).toBeLessThanOrEqual(Date.now())
    expect(Date.now() - startsAt).toBeLessThan(DAY + 3600 * 1000)
    expect(doc.endsAt ?? null).toBeNull()
  })

  test('ein Ende vor dem Beginn wird mit 400 abgelehnt', async () => {
    const id = Date.now()
    const group = await createServiceGroup({ name: `Lebenszyklus Gruppe C ${id}` })
    const response = await create({
      name: `Lebenszyklus C ${id}`, slug: `lebenszyklus-c-${id}`, status: 'operational', group: group.id,
      startsAt: new Date(Date.UTC(2026, 2, 10, 12)).toISOString(), endsAt: new Date(Date.UTC(2026, 2, 5, 12)).toISOString(),
    })
    expect(response.status).toBe(400)
  })
})
