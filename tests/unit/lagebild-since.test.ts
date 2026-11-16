import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_DATETIME_CONFIG } from '@/lib/datetime'
import { translatorsFor } from '@/lib/i18n/translators'
import { availabilitySinceLabel, mergeTimelines, type Timeline } from '@/lib/lagebild'

const { tf } = translatorsFor('')
const DAY = 24 * 3600_000
const NOW = Date.UTC(2026, 10, 16, 12, 0, 0)
const WINDOW_START = NOW - 14 * DAY
const label = (timeline: Timeline) => availabilitySinceLabel(timeline, WINDOW_START, NOW, DEFAULT_DATETIME_CONFIG, tf)

test('reicht das Protokoll über den ganzen Zeitraum zurück, bleibt der Text leer', () => {
  assert.equal(label([{ at: WINDOW_START - DAY, status: 'operational' }]), '')
})

test('beginnt das Protokoll erst im Zeitraum, steht der Beginn im Text', () => {
  const text = label([{ at: NOW - 3 * DAY, status: 'operational' }])
  assert.ok(text.length > 0)
  assert.match(text, /2026/)
})

test('ohne bekannten Zustand im Zeitraum bleibt der Text leer', () => {
  assert.equal(label([]), '')
  assert.equal(label([{ at: NOW + DAY, status: 'operational' }]), '')
})

test('für eine Gruppe zählt der früheste bekannte Zustand ihrer Dienste', () => {
  const early: Timeline = [{ at: NOW - 5 * DAY, status: 'operational' }]
  const late: Timeline = [{ at: NOW - 2 * DAY, status: 'operational' }]
  const group = label(mergeTimelines([early, late]))
  assert.equal(group, label(early), 'die Gruppe beginnt mit dem früheren Dienst')
  assert.notEqual(group, label(late))
  // reicht ein Dienst über den ganzen Zeitraum zurück, ist auch die Gruppe vollständig bekannt
  const full: Timeline = [{ at: WINDOW_START - DAY, status: 'operational' }]
  assert.equal(label(mergeTimelines([full, late])), '')
})
