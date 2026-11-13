import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Field } from 'payload'
import { EmailSettings } from '@/globals/EmailSettings'

/** Das Global ist öffentlich lesbar. Adressen von Mitarbeitern dürfen anonym nicht erscheinen. */
function find(fields: Field[], name: string): (Field & { access?: { read?: (args: unknown) => boolean } }) | undefined {
  for (const field of fields) {
    if ('name' in field && field.name === name) return field as never
    if ('fields' in field && Array.isArray(field.fields)) {
      const inner = find(field.fields as Field[], name)
      if (inner) return inner
    }
  }
  return undefined
}

for (const name of ['reportRecipients', 'subscriberRequestTo']) {
  test(`${name} ist anonym nicht lesbar, für angemeldete Nutzer schon`, () => {
    const read = find(EmailSettings.fields, name)?.access?.read
    assert.equal(typeof read, 'function', 'Feldzugriff fehlt')
    assert.equal(read!({ req: { user: null } }), false)
    assert.equal(read!({ req: { user: { id: 1 } } }), true)
  })
}
