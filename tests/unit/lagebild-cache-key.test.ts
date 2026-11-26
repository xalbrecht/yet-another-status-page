import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lagebildCacheKey } from '../../src/lib/lagebild'

// Das Ergebnis enthält übersetzte Texte. Der Eintrag gilt je Sprache.
// Ein Besucher darf nie den Eintrag einer anderen Sprache bekommen.
test('der Schlüssel des Zwischenspeichers hängt von der Sprache ab', () => {
  assert.notDeepEqual(lagebildCacheKey('de'), lagebildCacheKey('en'))
  assert.deepEqual(lagebildCacheKey('fr'), lagebildCacheKey('fr'))
  assert.equal(lagebildCacheKey('de')[0], 'lagebild')
})

// Einstellung „Zwischenspeicher des Lagebilds“: 1, 3, 5 oder 10 Minuten. Leer oder ungültig: Vorgabe der Installation.
test('cacheSecondsFromSetting: Minuten der Einstellung werden zu Sekunden', async () => {
  const { cacheSecondsFromSetting } = await import('../../src/lib/lagebild')
  assert.equal(cacheSecondsFromSetting('1', 45), 60)
  assert.equal(cacheSecondsFromSetting('3', 45), 180)
  assert.equal(cacheSecondsFromSetting('5', 45), 300)
  assert.equal(cacheSecondsFromSetting('10', 45), 600)
})

test('cacheSecondsFromSetting: leer oder ungültig ergibt die Vorgabe der Installation', async () => {
  const { cacheSecondsFromSetting } = await import('../../src/lib/lagebild')
  for (const value of [undefined, null, '', '2', '0', 'abc', 7]) assert.equal(cacheSecondsFromSetting(value, 45), 45)
})
