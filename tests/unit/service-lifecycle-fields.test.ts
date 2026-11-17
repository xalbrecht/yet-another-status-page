import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Field } from 'payload'
import { Services } from '@/collections/Services'
import { dayBoundary } from '@/lib/service-lifecycle'

type Validate = (value: unknown, options: { data?: Record<string, unknown>; siblingData?: Record<string, unknown> }) => true | string
type Hook = (args: { value?: unknown; req: unknown }) => unknown | Promise<unknown>
type DateField = Field & { required?: boolean; defaultValue?: unknown; validate?: Validate; hooks?: { beforeValidate?: Hook[]; beforeChange?: Hook[] }; admin?: { position?: string; date?: { pickerAppearance?: string } } }
const find = (name: string) => Services.fields.find((f) => 'name' in f && f.name === name) as DateField | undefined

test('startsAt ist ein Pflichtfeld vom Typ Datum mit Vorgabe heute, Eingabe nur als Tag, in der Seitenleiste', () => {
  const field = find('startsAt')
  assert.ok(field, 'Feld fehlt')
  assert.equal((field as { type: string }).type, 'date')
  assert.equal(field.required, true)
  assert.equal(typeof field.defaultValue, 'function')
  assert.equal(field.admin?.position, 'sidebar')
  assert.equal(field.admin?.date?.pickerAppearance, 'dayOnly')
})

test('endsAt ist optional, vom Typ Datum, Eingabe nur als Tag, in der Seitenleiste', () => {
  const field = find('endsAt')
  assert.ok(field, 'Feld fehlt')
  assert.equal((field as { type: string }).type, 'date')
  assert.notEqual(field.required, true)
  assert.equal(field.admin?.position, 'sidebar')
  assert.equal(field.admin?.date?.pickerAppearance, 'dayOnly')
})

test('Beginn und Ende stehen unter den Spalten der Liste', () => {
  const columns = Services.admin?.defaultColumns ?? []
  assert.ok(columns.includes('startsAt'))
  assert.ok(columns.includes('endsAt'))
})

test('die Prüfung am Ende-Feld lehnt ein Ende vor dem Beginn ab und erlaubt den gleichen Tag', () => {
  const validate = find('endsAt')?.validate
  assert.equal(typeof validate, 'function')
  const start = '2026-11-10T00:00:00.000Z'
  assert.equal(validate!('2026-11-09T23:59:59.999Z', { data: { startsAt: start } }) === true, false)
  assert.equal(validate!('2026-11-10T23:59:59.999Z', { data: { startsAt: start } }), true)
  assert.equal(validate!(null, { data: { startsAt: start } }), true)
  assert.equal(validate!(undefined, { data: { startsAt: start } }), true)
})

test('dayBoundary: Beginn ist der Tagesanfang, Ende das Tagesende in der Zeitzone der Installation', () => {
  // 17.11.2026 12:00 UTC ist in Berlin (UTC+1) der 17.11. um 13:00
  const picked = new Date(Date.UTC(2026, 10, 17, 12, 0, 0))
  assert.equal(dayBoundary(picked, 'start', 'Europe/Berlin').toISOString(), '2026-11-16T23:00:00.000Z')
  assert.equal(dayBoundary(picked, 'end', 'Europe/Berlin').toISOString(), '2026-11-17T22:59:59.999Z')
  assert.equal(dayBoundary(picked, 'start', 'UTC').toISOString(), '2026-11-17T00:00:00.000Z')
  assert.equal(dayBoundary(picked, 'end', 'UTC').toISOString(), '2026-11-17T23:59:59.999Z')
})
