import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ta } from '../../src/lib/i18n/admin'

// Das zweite Argument von ta() war früher der deutsche Text, jetzt ist es ein Zusatz.
// Ein alter Aufruf soll nicht mehr kompilieren, sonst geht der deutsche Text still verloren.
test('ta() akzeptiert als zweites Argument nur die bekannten Zusätze', () => {
  // @ts-expect-error – ein deutscher Text ist kein gültiger Zusatz
  const alt = ta('Generic', 'Allgemein')
  assert.equal(typeof alt, 'string')
  assert.equal(typeof ta('Admin', 'role'), 'string')
  assert.equal(typeof ta('Incidents', 'log'), 'string')
  assert.equal(typeof ta('Media', 'single'), 'string')
})
