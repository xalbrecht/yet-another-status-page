import { test } from 'node:test'
import assert from 'node:assert/strict'
import { activeServiceWhere, endsAtBeforeStart, isServiceActive, isServiceEnded, isServiceNotStarted } from '@/lib/service-lifecycle'

const START = Date.UTC(2025, 0, 1)
const END_OF_DAY = Date.UTC(2026, 10, 30, 23, 59, 59, 999)
const NEXT_DAY = Date.UTC(2026, 11, 1, 0, 0, 0, 0)

test('ein Dienst ohne Ende ist ab dem Beginn aktiv', () => {
  assert.equal(isServiceActive({ startsAt: START }, START), true)
  assert.equal(isServiceActive({ startsAt: START, endsAt: null }, NEXT_DAY), true)
})

test('ein Dienst ist vor dem Beginn nicht aktiv und gilt als noch nicht begonnen', () => {
  assert.equal(isServiceActive({ startsAt: START }, START - 1), false)
  assert.equal(isServiceNotStarted({ startsAt: START }, START - 1), true)
  assert.equal(isServiceNotStarted({ startsAt: START }, START), false)
})

test('der Endtag zählt noch mit: um 23:59 aktiv, um 00:00 des Folgetags beendet', () => {
  const service = { startsAt: START, endsAt: END_OF_DAY }
  assert.equal(isServiceActive(service, END_OF_DAY), true)
  assert.equal(isServiceEnded(service, END_OF_DAY), false)
  assert.equal(isServiceActive(service, NEXT_DAY), false)
  assert.equal(isServiceEnded(service, NEXT_DAY), true)
})

test('ein Dienst ohne Ende gilt nie als beendet', () => {
  assert.equal(isServiceEnded({ startsAt: START }, NEXT_DAY), false)
})

test('Zeitangaben als Text und als Datum werden gleich behandelt', () => {
  const service = { startsAt: new Date(START).toISOString(), endsAt: new Date(END_OF_DAY) }
  assert.equal(isServiceActive(service, START), true)
  assert.equal(isServiceActive(service, NEXT_DAY), false)
})

test('activeServiceWhere verlangt Beginn erreicht und Ende leer oder nicht überschritten', () => {
  const at = Date.UTC(2026, 10, 17, 12, 0, 0)
  const iso = new Date(at).toISOString()
  assert.deepEqual(activeServiceWhere(at), {
    and: [
      { startsAt: { less_than_equal: iso } },
      { or: [{ endsAt: { exists: false } }, { endsAt: { greater_than_equal: iso } }] },
    ],
  })
})

test('endsAtBeforeStart: gleicher Tag ist erlaubt, davor nicht', () => {
  assert.equal(endsAtBeforeStart(START, START), false)
  assert.equal(endsAtBeforeStart(START, START - 1), true)
  assert.equal(endsAtBeforeStart(START, null), false)
  assert.equal(endsAtBeforeStart(START, undefined), false)
})
