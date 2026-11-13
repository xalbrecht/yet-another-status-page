import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Settings } from '@/globals/Settings'

type AnyField = { name?: string; fields?: AnyField[]; [key: string]: unknown }

function findField(fields: AnyField[], name: string): AnyField | undefined {
  for (const field of fields) {
    if (field.name === name) return field
    if (field.fields) {
      const nested = findField(field.fields, name)
      if (nested) return nested
    }
  }
  return undefined
}

const field = (name: string): AnyField => {
  const found = findField(Settings.fields as unknown as AnyField[], name)
  assert.ok(found, `Feld ${name} fehlt`)
  return found
}
const optionValues = (name: string) =>
  (field(name).options as Array<{ value: string }>).map((option) => option.value)

test('statusBoxEntries: Zahl von 1 bis 10, Voreinstellung 3', () => {
  const entries = field('statusBoxEntries')
  assert.equal(entries.type, 'number')
  assert.equal(entries.defaultValue, 3)
  assert.equal(entries.min, 1)
  assert.equal(entries.max, 10)
})

test('statusBoxContent: full oder compact, Voreinstellung full', () => {
  assert.deepEqual(optionValues('statusBoxContent'), ['full', 'compact'])
  assert.equal(field('statusBoxContent').defaultValue, 'full')
})

test('statusBoxesPlacement: before oder after, Voreinstellung before', () => {
  assert.deepEqual(optionValues('statusBoxesPlacement'), ['before', 'after'])
  assert.equal(field('statusBoxesPlacement').defaultValue, 'before')
})

test('die drei Felder sind bei Variante C (off) ausgeblendet', () => {
  for (const name of ['statusBoxEntries', 'statusBoxContent', 'statusBoxesPlacement']) {
    const condition = (field(name).admin as { condition?: (data: Record<string, unknown>) => boolean }).condition
    assert.ok(condition, `${name} hat keine Bedingung`)
    assert.equal(condition({ lagebildVariant: 'off' }), false)
    assert.equal(condition({ lagebildVariant: 'a' }), true)
    assert.equal(condition({ lagebildVariant: 'both' }), true)
  }
})

test('lagebildVariant behält die Werte off, a, b, both und nennt off „Variant C“', () => {
  assert.deepEqual(optionValues('lagebildVariant'), ['off', 'a', 'b', 'both'])
  const off = (field('lagebildVariant').options as Array<{ value: string; label: unknown }>).find((o) => o.value === 'off')
  assert.match(JSON.stringify(off?.label), /Varian(t|te) C/)
})
