import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import type { Field } from 'payload'
import { Incidents } from '@/collections/Incidents'
import { getServerUrl } from '@/lib/utils'

const beforeChange = Incidents.hooks?.beforeChange?.[0] as (args: { data: Record<string, unknown>; operation: string; originalDoc?: Record<string, unknown> }) => Record<string, unknown>
type Update = { status: string; message: string; smsBody?: string; ntfyBody?: string; createdAt: string }
const update = (over: Partial<Update> = {}): Update => ({ status: 'investigating', message: 'Text', createdAt: '2026-11-16T10:00:00.000Z', ...over })

const original = process.env.PAYLOAD_PUBLIC_ALLOW_WRITES
afterEach(() => {
  if (original === undefined) delete process.env.PAYLOAD_PUBLIC_ALLOW_WRITES
  else process.env.PAYLOAD_PUBLIC_ALLOW_WRITES = original
})

test('beim Anlegen ersetzt der Hook {{link}} in Titel, Text, SMS- und ntfy-Text durch die Adresse der Störung', () => {
  const result = beforeChange({
    operation: 'create',
    data: { title: 'T {{link}}', updates: [update({ message: 'Mehr: {{link}}', smsBody: 'S {{link}}', ntfyBody: 'N {{ link }}' })] },
  })
  const link = `${getServerUrl()}/i/${result.shortId}`
  assert.match(String(result.shortId), /^[A-Za-z0-9]{8}$/)
  const updates = result.updates as Update[]
  assert.equal(result.title, `T ${link}`)
  assert.equal(updates[0].message, `Mehr: ${link}`)
  assert.equal(updates[0].smsBody, `S ${link}`)
  assert.equal(updates[0].ntfyBody, `N ${link}`)
})

test('bei einer Änderung gilt die Kennung der vorhandenen Störung', () => {
  const result = beforeChange({ operation: 'update', originalDoc: { shortId: 'abc12345' }, data: { updates: [update({ smsBody: 'Link {{link}}' })] } })
  assert.equal((result.updates as Update[])[0].smsBody, `Link ${getServerUrl()}/i/abc12345`)
})

test('ohne Kennung (Änderung ohne vorhandene Störung) bleibt {{link}} stehen', () => {
  const result = beforeChange({ operation: 'update', data: { title: 'T {{link}}', updates: [update()] } })
  assert.equal(result.title, 'T {{link}}')
})

test('Texte ohne Platzhalter und andere Platzhalter bleiben unverändert', () => {
  const result = beforeChange({ operation: 'create', data: { title: 'Titel {{services}}', updates: [update({ message: 'Ohne Link', smsBody: undefined })] } })
  assert.equal(result.title, 'Titel {{services}}')
  assert.equal((result.updates as Update[])[0].message, 'Ohne Link')
  assert.equal((result.updates as Update[])[0].smsBody, undefined)
})

test('SMS- und ntfy-Text der Aktualisierung sind versteckt und nur für Angemeldete lesbar und schreibbar', () => {
  const updates = Incidents.fields.find((field) => 'name' in field && field.name === 'updates') as Extract<Field, { type: 'array' }>
  for (const name of ['smsBody', 'ntfyBody']) {
    const field = updates.fields.find((f) => 'name' in f && f.name === name) as Extract<Field, { type: 'textarea' }>
    assert.ok(field, name)
    assert.equal(field.admin?.hidden, true, `${name} ist im Formular versteckt`)
    delete process.env.PAYLOAD_PUBLIC_ALLOW_WRITES
    for (const operation of ['read', 'create', 'update'] as const) {
      const access = field.access?.[operation] as (args: unknown) => unknown
      assert.equal(access({ req: { user: null } }), false, `${name}.${operation} ohne Anmeldung`)
      assert.equal(access({ req: { user: { id: 1 } } }), true, `${name}.${operation} angemeldet`)
    }
  }
})
