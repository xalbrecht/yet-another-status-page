import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultGroupId } from '@/lib/report/load'
import { outageWord, serviceWord } from '@/lib/report/format'

// Standardgruppe der Gruppenberichte: bisher nur per E2E abgedeckt (Issue #116)
const list = [{ id: 7 }, { id: 3 }]

test('Gruppenberichte ohne Gruppenwahl: die erste Gruppe der Liste (die schwächste) ist vorgewählt', () => {
  assert.equal(defaultGroupId({ view: 'groups', group: undefined }, list), 7)
})

test('mit gewählter Gruppe, im Gesamtbericht oder ohne Gruppen gilt keine Vorgabe', () => {
  assert.equal(defaultGroupId({ view: 'groups', group: '3' }, list), null)
  assert.equal(defaultGroupId({ view: 'overall', group: undefined }, list), null)
  assert.equal(defaultGroupId({ view: 'groups', group: undefined }, []), null)
})

test('Zählwörter: eins im Singular, sonst im Plural', () => {
  assert.match(serviceWord(1), /^(Dienst|service)$/)
  assert.match(serviceWord(0), /^(Dienste|services)$/)
  assert.match(serviceWord(2), /^(Dienste|services)$/)
  assert.match(outageWord(1), /^(Ausfall|outage)$/)
  assert.match(outageWord(3), /^(Ausfälle|outages)$/)
})
