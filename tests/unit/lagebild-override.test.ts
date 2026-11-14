import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseLagebildOverride } from '@/lib/lagebild'

test('parseLagebildOverride nimmt a und b, auch groß geschrieben', () => {
  assert.equal(parseLagebildOverride('a'), 'a')
  assert.equal(parseLagebildOverride('b'), 'b')
  assert.equal(parseLagebildOverride('A'), 'a')
  assert.equal(parseLagebildOverride('B'), 'b')
})

test('parseLagebildOverride liest bei mehreren Werten den ersten', () => {
  assert.equal(parseLagebildOverride(['b', 'a']), 'b')
})

test('parseLagebildOverride ergibt für alles andere null', () => {
  for (const value of ['c', 'ab', '', ' a', 'both', 'off', undefined, null, 1, [], {}]) {
    assert.equal(parseLagebildOverride(value), null, `Wert ${JSON.stringify(value)}`)
  }
})
