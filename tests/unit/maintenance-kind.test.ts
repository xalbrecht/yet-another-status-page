import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Maintenances } from '@/collections/Maintenances'
import { isMaintenanceKind, MAINTENANCE_KINDS } from '@/lib/maintenance-kind'

type Field = { name?: string; type?: string; required?: boolean; defaultValue?: unknown; options?: Array<{ value: string }> }
const field = (Maintenances.fields as Field[]).find((entry) => entry.name === 'maintenanceKind')

test('Art der Wartung: Pflichtfeld mit den Werten „sla“ und „additional“, ohne Vorgabe', () => {
  assert.ok(field, 'Feld maintenanceKind fehlt an der Wartung')
  assert.equal(field.type, 'select')
  assert.equal(field.required, true)
  assert.equal(field.defaultValue, undefined)
  assert.deepEqual(field.options?.map((option) => option.value), ['sla', 'additional'])
})

test('MAINTENANCE_KINDS und isMaintenanceKind kennen genau die beiden Werte', () => {
  assert.deepEqual([...MAINTENANCE_KINDS], ['sla', 'additional'])
  assert.equal(isMaintenanceKind('sla'), true)
  assert.equal(isMaintenanceKind('additional'), true)
  assert.equal(isMaintenanceKind(''), false)
  assert.equal(isMaintenanceKind(undefined), false)
  assert.equal(isMaintenanceKind('SLA'), false)
})
