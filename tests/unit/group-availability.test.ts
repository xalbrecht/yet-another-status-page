import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeAvailability, mergeTimelines, type Timeline } from '@/lib/availability'

const A: Timeline = [
  { at: 0, status: 'operational' },
  { at: 10, status: 'partial' },
  { at: 20, status: 'operational' },
]
const B: Timeline = [
  { at: 0, status: 'operational' },
  { at: 15, status: 'degraded' },
]

test('mergeTimelines nimmt an jedem Wechsel den schlechtesten Zustand und lässt Wiederholungen weg', () => {
  assert.deepEqual(mergeTimelines([A, B]), [
    { at: 0, status: 'operational' },
    { at: 10, status: 'partial' },
    { at: 20, status: 'degraded' },
  ])
})

test('mergeTimelines ohne Eingabe oder mit leeren Zeitfolgen ergibt eine leere Zeitfolge', () => {
  assert.deepEqual(mergeTimelines([]), [])
  assert.deepEqual(mergeTimelines([[], []]), [])
})

test('mergeTimelines verdeckt nichts, wenn eine Zeitfolge später beginnt', () => {
  assert.deepEqual(
    mergeTimelines([[{ at: 5, status: 'major' }], [{ at: 0, status: 'operational' }]]),
    [
      { at: 0, status: 'operational' },
      { at: 5, status: 'major' },
    ],
  )
})

test('mergeTimelines lässt die Eingabe unverändert und ordnet die Zeitpunkte aufsteigend', () => {
  const before = JSON.stringify([A, B])
  const merged = mergeTimelines([B, A])
  assert.equal(JSON.stringify([A, B]), before)
  assert.deepEqual(merged.map((entry) => entry.at), [...merged.map((entry) => entry.at)].sort((a, b) => a - b))
})

test('Verfügbarkeit der Gruppe: Teilausfall eines Dienstes zählt für die ganze Gruppe als Ausfall', () => {
  assert.equal(computeAvailability(mergeTimelines([A, B]), 0, 40), 75)
})
