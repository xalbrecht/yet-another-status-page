import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Field } from 'payload'
import { Subscribers } from '@/collections/Subscribers'
import { Users } from '@/collections/Users'

type Access = { read?: (args: unknown) => boolean; create?: (args: unknown) => boolean; update?: (args: unknown) => boolean }
const find = (fields: Field[], name: string) => fields.find((f) => 'name' in f && f.name === name) as (Field & { access?: Access; defaultValue?: unknown; admin?: { position?: string } }) | undefined

/** Das Kennzeichen ist nur eine Markierung: Vorgabe aus, Seitenleiste, Spalte in der Liste. Anonym nicht lesbar oder setzbar. */
for (const [name, collection] of [['subscribers', Subscribers], ['users', Users]] as const) {
  test(`${name}: isTest ist ein Kontrollkästchen mit Vorgabe aus in der Seitenleiste`, () => {
    const field = find(collection.fields, 'isTest')
    assert.ok(field, 'Feld fehlt')
    assert.equal((field as { type: string }).type, 'checkbox')
    assert.equal(field.defaultValue, false)
    assert.equal(field.admin?.position, 'sidebar')
  })

  test(`${name}: isTest steht unter den Spalten der Liste`, () => {
    assert.ok(collection.admin?.defaultColumns?.includes('isTest'))
  })
}

test('subscribers: isTest ist anonym nicht lesbar und nicht setzbar, für Admins schon', () => {
  const access = find(Subscribers.fields, 'isTest')?.access
  for (const op of ['read', 'create', 'update'] as const) {
    assert.equal(typeof access?.[op], 'function', `Zugriff ${op} fehlt`)
    assert.equal(access![op]!({ req: { user: null } }), false, `${op} anonym`)
    assert.equal(access![op]!({ req: { user: { id: 1 } } }), false, `${op} ohne Rolle`)
    assert.equal(access![op]!({ req: { user: { id: 1, roles: ['admin'] } } }), true, `${op} Admin`)
  }
})
