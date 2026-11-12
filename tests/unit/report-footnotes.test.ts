import { test } from 'node:test'
import assert from 'node:assert/strict'
import { countFootnotes, type FootnoteIncident } from '@/lib/report/footnotes'

const DAY = 86_400_000
const START = Date.parse('2026-01-01T00:00:00Z')
const FIRST_OPERATION = Date.parse('2026-11-10T15:56:00Z')

const incident = (extra: Partial<FootnoteIncident>): FootnoteIncident => ({
  title: 'Störung X - Analysephase',
  messages: [],
  availabilityClass: 'auto',
  createdAt: Date.parse('2026-03-01T00:00:00Z'),
  resolvedAt: Date.parse('2026-03-02T00:00:00Z'),
  serviceIds: [1],
  ...extra,
})
const range = { rangeStart: START, rangeEnd: START + 300 * DAY, firstOperationAt: FIRST_OPERATION, groupServiceIds: null as number[] | null }

test('zählt unsichere Vorfälle und Vorfälle ohne Dienst im ganzen angezeigten Bereich', () => {
  const result = countFootnotes([incident({}), incident({ serviceIds: [] }), incident({ title: 'Teilweiser Ausfall X' })], range)
  assert.deepEqual(result, { unsure: 1, withoutService: 1 })
})

test('Vorfälle nach dem ersten Betriebseintrag oder außerhalb des Bereichs zählen nicht', () => {
  const late = incident({ createdAt: FIRST_OPERATION + DAY, resolvedAt: FIRST_OPERATION + 2 * DAY })
  const before = incident({ createdAt: START - 10 * DAY, resolvedAt: START - 5 * DAY })
  assert.deepEqual(countFootnotes([late, before], range), { unsure: 0, withoutService: 0 })
})

test('bei gewählter Gruppe zählen nur Vorfälle mit einem Dienst der Gruppe, Vorfälle ohne Dienst nicht', () => {
  const inGroup = incident({ serviceIds: [1, 5] })
  const otherGroup = incident({ serviceIds: [9] })
  const noService = incident({ serviceIds: [] })
  assert.deepEqual(countFootnotes([inGroup, otherGroup, noService], { ...range, groupServiceIds: [1, 2] }), { unsure: 1, withoutService: 0 })
})

test('ein offener Vorfall zählt bis zum Ende des Bereichs', () => {
  assert.deepEqual(countFootnotes([incident({ resolvedAt: null })], range), { unsure: 1, withoutService: 0 })
})
