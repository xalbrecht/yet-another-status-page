import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Service, ServiceGroup } from '@/payload-types'
import { serializeService, serializeServiceGroups } from '@/lib/api/v1/serializers'
import { serviceSchema } from '@/lib/api/v1/schemas'
import { buildOpenApiDocument } from '@/lib/api/v1/openapi'

const group = { id: 1, name: 'Gruppe', slug: 'gruppe', updatedAt: '', createdAt: '' } as unknown as ServiceGroup
const service = (id: number, slug: string) =>
  ({ id, slug, name: slug, status: 'operational', group, startsAt: '2026-01-01', updatedAt: '2026-11-19T10:00:00.000Z', createdAt: '' }) as unknown as Service

test('Dienst in der Schnittstelle: maintenance zeigt, ob eine Wartung läuft', () => {
  assert.equal(serializeService(service(1, 'a'), true).maintenance, true)
  assert.equal(serializeService(service(1, 'a'), false).maintenance, false)
})

test('Dienste in den Gruppen von /status tragen das Feld je Dienst', () => {
  const services = [service(1, 'a'), service(2, 'b')]
  const result = serializeServiceGroups([group], services, new Set(['2']))
  assert.deepEqual(result[0].services.map((s) => [s.slug, s.maintenance]), [['a', false], ['b', true]])
})

test('Schema und OpenAPI-Beschreibung kennen das Feld, bestehende Felder bleiben', () => {
  const parsed = serviceSchema.parse(serializeService(service(1, 'a'), true))
  assert.equal(parsed.maintenance, true)
  assert.equal(parsed.slug, 'a')
  const doc = buildOpenApiDocument('Test') as unknown as { components: { schemas: { Service: { properties: Record<string, { description?: string }>; required: string[] } } } }
  const schema = doc.components.schemas.Service
  assert.ok(schema.properties.maintenance, 'maintenance fehlt im Schema Service')
  assert.match(schema.properties.maintenance.description ?? '', /in_progress/)
  assert.ok(schema.required.includes('maintenance'))
  for (const name of ['slug', 'name', 'description', 'status', 'group', 'updatedAt']) assert.ok(schema.properties[name], `${name} fehlt`)
})
