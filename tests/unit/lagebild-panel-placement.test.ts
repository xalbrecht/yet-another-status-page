import { test } from 'node:test'
import assert from 'node:assert/strict'
import { caretPosition, panelFollowsTile } from '@/components/status/lagebild/panel-placement'

/** Kacheln, hinter denen der Aufklappbereich steht, für `total` Gruppen in `columns` Spalten. */
const anchors = (total: number, columns: number, selected: number) =>
  Array.from({ length: total }, (_, index) => index).filter((index) => panelFollowsTile(index, total, columns, selected))

test('ohne Auswahl steht kein Aufklappbereich im Raster', () => {
  assert.deepEqual(anchors(6, 3, -1), [])
})

test('der Bereich steht hinter der letzten Kachel der Zeile der gewählten Gruppe', () => {
  // 6 Gruppen, 3 Spalten: Zeile 1 = 0..2, Zeile 2 = 3..5
  assert.deepEqual(anchors(6, 3, 0), [2])
  assert.deepEqual(anchors(6, 3, 2), [2])
  assert.deepEqual(anchors(6, 3, 3), [5])
})

test('bei einer unvollständigen letzten Zeile steht der Bereich hinter der letzten Gruppe', () => {
  // 5 Gruppen, 4 Spalten: Zeile 2 enthält nur die Gruppe 4
  assert.deepEqual(anchors(5, 4, 4), [4])
  assert.deepEqual(anchors(5, 4, 1), [3])
})

test('mit einer Spalte steht der Bereich hinter der gewählten Gruppe selbst', () => {
  assert.deepEqual(anchors(3, 1, 1), [1])
})

test('mit zwei Spalten und einer einzelnen Gruppe steht der Bereich dahinter', () => {
  assert.deepEqual(anchors(1, 2, 0), [0])
})

test('die Kachel „Alle“ zählt nicht mit: bei vier Gruppen und vier Spalten steht die erste Gruppe in Spalte 1', () => {
  assert.equal(caretPosition(0, 4), 12.5)
  assert.equal(caretPosition(3, 4), 87.5)
})

test('der Pfeil zeigt in die Mitte der Spalte der gewählten Gruppe', () => {
  assert.equal(caretPosition(4, 4), 12.5)
  assert.equal(caretPosition(1, 2), 75)
  assert.equal(caretPosition(2, 1), 50)
})
