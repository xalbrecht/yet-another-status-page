import { test } from 'node:test'
import assert from 'node:assert/strict'
import { wizardAccess, wizardKind } from '../../src/lib/wizard-access'
import type { RoleUser } from '../../src/lib/roles'

// Assistent „Neu erstellen mit Vorlage“ (Issue #285): Störungen legen Admin und ServiceDesk an, Wartungen auch der Produktmanager.
const admin: RoleUser = { roles: ['admin'] }
const desk: RoleUser = { roles: ['servicedesk'], servicedeskAlleGruppen: false, servicedeskGruppen: [1] }
const pm: RoleUser = { roles: ['produktmanager'], produktmanagerAlleGruppen: false, produktmanagerGruppen: [2] }
const both: RoleUser = { roles: ['servicedesk', 'produktmanager'], servicedeskGruppen: [1], produktmanagerGruppen: [2] }

test('Admin und ServiceDesk: Störung und Wartung', () => {
  assert.deepEqual(wizardAccess(admin).kinds, ['incident', 'maintenance'])
  assert.deepEqual(wizardAccess(desk).kinds, ['incident', 'maintenance'])
})

test('Produktmanager: nur Wartung, mit dem Bereich seiner Gruppen', () => {
  const access = wizardAccess(pm)
  assert.deepEqual(access.kinds, ['maintenance'])
  assert.deepEqual(access.maintenanceScope, [2])
  assert.deepEqual(access.incidentScope, [])
})

test('ServiceDesk und Produktmanager: Störungen im Bereich des ServiceDesk, Wartungen in beiden', () => {
  const access = wizardAccess(both)
  assert.deepEqual(access.kinds, ['incident', 'maintenance'])
  assert.deepEqual(access.incidentScope, [1])
  assert.deepEqual([...(access.maintenanceScope as number[])].sort(), [1, 2])
})

test('Admin: Bereich „alle“', () => {
  assert.equal(wizardAccess(admin).incidentScope, 'all')
  assert.equal(wizardAccess(admin).maintenanceScope, 'all')
})

test('ohne Rolle: keine Art', () => {
  assert.deepEqual(wizardAccess({ roles: [] }).kinds, [])
})

test('wizardKind: gewünschte Art, sonst die erste erlaubte', () => {
  assert.equal(wizardKind('maintenance', ['incident', 'maintenance']), 'maintenance')
  assert.equal(wizardKind(undefined, ['incident', 'maintenance']), 'incident')
  assert.equal(wizardKind('incident', ['maintenance']), 'maintenance')
  assert.equal(wizardKind('unsinn', ['maintenance']), 'maintenance')
})
