import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chunkRows, heatClass } from '@/lib/report/heat'

const numbers = (count: number) => Array.from({ length: count }, (_, index) => index)

test('chunkRows teilt 30 Zeilen in Blöcke zu 12, 12 und 6', () => {
  assert.deepEqual(chunkRows(numbers(30)).map((chunk) => chunk.length), [12, 12, 6])
})

test('chunkRows lässt genau 12 Zeilen in einem Block', () => {
  assert.deepEqual(chunkRows(numbers(12)).map((chunk) => chunk.length), [12])
})

test('chunkRows ergibt für keine Zeilen keinen Block', () => {
  assert.deepEqual(chunkRows([]), [])
})

test('chunkRows nutzt die übergebene Blockgröße', () => {
  assert.deepEqual(chunkRows(numbers(5), 2).map((chunk) => chunk.length), [2, 2, 1])
})

test('heatClass ordnet die Farbstufen zu', () => {
  assert.equal(heatClass(100, 99), 0)
  assert.equal(heatClass(null, 99), 0)
  assert.equal(heatClass(99.95, 99), 1)
  assert.equal(heatClass(99.6, 99), 2)
  assert.equal(heatClass(99.2, 99), 3)
  assert.equal(heatClass(98, 99), 4)
})
