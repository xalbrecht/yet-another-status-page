import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lagebildCacheKey } from '../../src/lib/lagebild'

// Das Ergebnis enthält übersetzte Texte. Next speichert es auf der Platte, es überlebt einen Neustart.
// Ändert sich die Sprache (DEFAULT_LANGUAGE), darf der alte Eintrag nicht ausgeliefert werden.
test('der Schlüssel des Zwischenspeichers hängt von der Sprache ab', () => {
  assert.notDeepEqual(lagebildCacheKey('de'), lagebildCacheKey('en'))
  assert.deepEqual(lagebildCacheKey('fr'), lagebildCacheKey('fr'))
  assert.equal(lagebildCacheKey('de')[0], 'lagebild')
})
