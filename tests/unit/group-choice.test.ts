import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseGroupChoice } from '@/lib/group-choice'

const known = [1, 2, 3]

test('ohne Angabe gilt „alle Dienstgruppen“', () => {
  assert.deepEqual(parseGroupChoice({}, known), { ok: true, allGroups: true, groups: [] })
  assert.deepEqual(parseGroupChoice(undefined, known), { ok: true, allGroups: true, groups: [] })
  assert.deepEqual(parseGroupChoice({ allGroups: true }, known), { ok: true, allGroups: true, groups: [] })
})

test('mit „alle Dienstgruppen“ wird eine mitgesendete Auswahl ignoriert', () => {
  assert.deepEqual(parseGroupChoice({ allGroups: true, groups: [1, 2] }, known), { ok: true, allGroups: true, groups: [] })
})

test('ohne „alle Dienstgruppen“ zählt die Auswahl, doppelte Einträge entfallen', () => {
  assert.deepEqual(parseGroupChoice({ allGroups: false, groups: [2, 3, 2] }, known), { ok: true, allGroups: false, groups: [2, 3] })
})

test('ohne „alle Dienstgruppen“ ist mindestens eine Gruppe nötig', () => {
  for (const body of [{ allGroups: false }, { allGroups: false, groups: [] }, { allGroups: false, groups: null }]) {
    assert.deepEqual(parseGroupChoice(body, known), { ok: false, error: 'api.invalidGroups' }, JSON.stringify(body))
  }
})

test('unbekannte oder ungültige Kennungen werden abgelehnt', () => {
  for (const body of [
    { allGroups: false, groups: [99] },
    { allGroups: false, groups: [1, 99] },
    { allGroups: false, groups: ['x'] },
    { allGroups: false, groups: [1.5] },
    { allGroups: false, groups: 'abc' },
    { allGroups: 'false', groups: [1] },
  ]) {
    assert.deepEqual(parseGroupChoice(body, known), { ok: false, error: 'api.invalidGroups' }, JSON.stringify(body))
  }
})
