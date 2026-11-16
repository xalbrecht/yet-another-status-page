import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultGroupId } from '@/lib/report/load'
import { outageWord, serviceWord } from '@/lib/report/format'

// Standardgruppe der Gruppenberichte: bisher nur per E2E abgedeckt
test('Gruppenberichte ohne Gruppenwahl: die schwächste Gruppe ist vorgewählt', () => {
  assert.equal(defaultGroupId({ view: 'groups', group: undefined }, () => 7), 7)
})

test('mit gewählter Gruppe oder im Gesamtbericht gilt keine Vorgabe, und die Berechnung läuft nicht', () => {
  let calls = 0
  const weakest = () => { calls++; return 7 }
  assert.equal(defaultGroupId({ view: 'groups', group: '3' }, weakest), null)
  assert.equal(defaultGroupId({ view: 'overall', group: undefined }, weakest), null)
  assert.equal(calls, 0, 'die Gruppenliste wird nur berechnet, wenn die Vorgabe gebraucht wird')
})

test('ohne Gruppen mit Diensten bleibt es bei keiner Vorgabe', () => {
  assert.equal(defaultGroupId({ view: 'groups', group: undefined }, () => null), null)
})

test('Zählwörter: eins im Singular, sonst im Plural', () => {
  assert.match(serviceWord(1), /^(Dienst|service)$/)
  assert.match(serviceWord(0), /^(Dienste|services)$/)
  assert.match(serviceWord(2), /^(Dienste|services)$/)
  assert.match(outageWord(1), /^(Ausfall|outage)$/)
  assert.match(outageWord(3), /^(Ausfälle|outages)$/)
})
