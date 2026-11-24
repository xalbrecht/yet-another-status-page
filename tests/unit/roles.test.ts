import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupScope, hasAnyRole, hasRole, scopeAllows, type RoleUser } from '@/lib/roles'

const admin: RoleUser = { roles: ['admin'] }
const deskAll: RoleUser = { roles: ['servicedesk'], servicedeskAlleGruppen: true }
const deskNone: RoleUser = { roles: ['servicedesk'] }
const deskGroups: RoleUser = { roles: ['servicedesk'], servicedeskGruppen: [1, 2] }
const both: RoleUser = {
  roles: ['servicedesk', 'produktmanager'],
  servicedeskGruppen: [1],
  produktmanagerGruppen: [{ id: 2 }],
}

test('hasRole und hasAnyRole prüfen die Rollenliste', () => {
  assert.equal(hasRole(admin, 'admin'), true)
  assert.equal(hasRole(admin, 'servicedesk'), false)
  assert.equal(hasAnyRole(both, ['admin', 'produktmanager']), true)
  assert.equal(hasAnyRole(deskNone, ['admin', 'produktmanager']), false)
})

test('Benutzer ohne Rollen haben nirgends Zugriff', () => {
  for (const user of [null, undefined, {}, { roles: [] }, { roles: null }] as RoleUser[]) {
    assert.equal(hasAnyRole(user, ['admin', 'servicedesk', 'produktmanager']), false)
    assert.deepEqual(groupScope(user, ['servicedesk', 'produktmanager']), [])
    assert.equal(scopeAllows(user, ['servicedesk', 'produktmanager'], [1], 'any'), false)
  }
})

test('Admin hat den Bereich „alle“', () => {
  assert.equal(groupScope(admin, ['servicedesk']), 'all')
  assert.equal(scopeAllows(admin, ['servicedesk'], [], 'all'), true)
})

test('ServiceDesk mit Haken „alle Gruppen“ hat den Bereich „alle“', () => {
  assert.equal(groupScope(deskAll, ['servicedesk']), 'all')
})

test('ServiceDesk ohne Haken und ohne Gruppe hat keine Gruppe', () => {
  assert.deepEqual(groupScope(deskNone, ['servicedesk']), [])
})

test('Gruppen als Zahlen und als Objekte ergeben denselben Bereich', () => {
  assert.deepEqual(groupScope(deskGroups, ['servicedesk']), [1, 2])
  assert.deepEqual(groupScope({ roles: ['servicedesk'], servicedeskGruppen: [{ id: 1 }, { id: 2 }] }, ['servicedesk']), [1, 2])
})

test('Mit zwei Rollen gilt die Menge der jeweils gefragten Rolle', () => {
  assert.deepEqual(groupScope(both, ['servicedesk']), [1])
  assert.deepEqual(groupScope(both, ['produktmanager']), [2])
  assert.deepEqual(groupScope(both, ['servicedesk', 'produktmanager']), [1, 2])
})

test('Gruppen einer Rolle zählen nicht, wenn der Benutzer die Rolle nicht hat', () => {
  const user: RoleUser = { roles: ['servicedesk'], servicedeskGruppen: [1], produktmanagerGruppen: [2], produktmanagerAlleGruppen: true }
  assert.deepEqual(groupScope(user, ['produktmanager']), [])
})

test('scopeAllows: „any“ verlangt eine, „all“ jede Gruppe im Bereich', () => {
  assert.equal(scopeAllows(deskGroups, ['servicedesk'], [1, 3], 'any'), true)
  assert.equal(scopeAllows(deskGroups, ['servicedesk'], [1, 3], 'all'), false)
  assert.equal(scopeAllows(deskGroups, ['servicedesk'], [1, 2], 'all'), true)
  assert.equal(scopeAllows(deskGroups, ['servicedesk'], [3], 'any'), false)
})

test('scopeAllows: ohne Gruppen der Objekte darf nur Admin', () => {
  assert.equal(scopeAllows(deskAll, ['servicedesk'], [], 'any'), false)
  assert.equal(scopeAllows(deskAll, ['servicedesk'], [], 'all'), false)
  assert.equal(scopeAllows(admin, ['servicedesk'], [], 'all'), true)
})

test('scopeAllows: Bereich „alle“ erlaubt jede Gruppe', () => {
  assert.equal(scopeAllows(deskAll, ['servicedesk'], [7, 8], 'all'), true)
})
