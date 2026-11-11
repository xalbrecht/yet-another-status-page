import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildReconstructedEvents } from '@/lib/status-reconstruction'

const H = 3600_000
const A = Date.parse('2025-05-05T13:25:00Z')
const F = Date.parse('2026-11-10T15:56:00Z')
const services = [
  { id: 1, firstEventAt: F },
  { id: 2, firstEventAt: F },
]
const build = (incidents: Parameters<typeof buildReconstructedEvents>[0]['incidents']) =>
  buildReconstructedEvents({ anchorAt: A, services, incidents })
const forService = (events: ReturnType<typeof build>, id: number) =>
  events.filter((event) => event.serviceId === id).map(({ at, status }) => [at - A, status])

test('ohne Vorfälle bekommt jeder Dienst nur den Anker „Betriebsbereit“', () => {
  assert.deepEqual(build([]), [
    { serviceId: 1, at: A, status: 'operational' },
    { serviceId: 2, at: A, status: 'operational' },
  ])
})

test('ein Teilausfall erzeugt Beginn und Ende, andere Dienste bleiben unberührt', () => {
  const events = build([{ serviceIds: [1], from: A + 10 * H, to: A + 12 * H, status: 'partial' }])
  assert.deepEqual(forService(events, 1), [[0, 'operational'], [10 * H, 'partial'], [12 * H, 'operational']])
  assert.deepEqual(forService(events, 2), [[0, 'operational']])
})

test('bei Überlappung gilt der schlechteste Zustand', () => {
  const events = build([
    { serviceIds: [1], from: A + 10 * H, to: A + 14 * H, status: 'partial' },
    { serviceIds: [1], from: A + 12 * H, to: A + 13 * H, status: 'major' },
  ])
  assert.deepEqual(forService(events, 1), [
    [0, 'operational'],
    [10 * H, 'partial'],
    [12 * H, 'major'],
    [13 * H, 'partial'],
    [14 * H, 'operational'],
  ])
})

test('Eingeschränkt schlägt Wartung bei Überlappung', () => {
  const events = build([
    { serviceIds: [1], from: A + 10 * H, to: A + 14 * H, status: 'maintenance' },
    { serviceIds: [1], from: A + 11 * H, to: A + 12 * H, status: 'degraded' },
  ])
  assert.deepEqual(forService(events, 1), [
    [0, 'operational'],
    [10 * H, 'maintenance'],
    [11 * H, 'degraded'],
    [12 * H, 'maintenance'],
    [14 * H, 'operational'],
  ])
})

test('zwei Vorfälle mit gleichem Zustand direkt hintereinander werden zusammengefasst', () => {
  const events = build([
    { serviceIds: [1], from: A + 10 * H, to: A + 12 * H, status: 'partial' },
    { serviceIds: [1], from: A + 12 * H, to: A + 14 * H, status: 'partial' },
  ])
  assert.deepEqual(forService(events, 1), [[0, 'operational'], [10 * H, 'partial'], [14 * H, 'operational']])
})

test('ein Vorfall ohne Dauer erzeugt nichts', () => {
  const events = build([{ serviceIds: [1], from: A + 10 * H, to: A + 10 * H, status: 'partial' }])
  assert.deepEqual(forService(events, 1), [[0, 'operational']])
})

test('Einträge ab dem ersten Betriebseintrag des Dienstes entfallen', () => {
  const events = build([{ serviceIds: [1], from: F - H, to: F + 5 * H, status: 'partial' }])
  assert.deepEqual(
    events.filter((event) => event.serviceId === 1).map(({ at, status }) => [at, status]),
    [[A, 'operational'], [F - H, 'partial']],
  )
})

test('ein doppelt verknüpfter Dienst erzeugt keine doppelten Einträge', () => {
  const events = build([{ serviceIds: [1, 1], from: A + 10 * H, to: A + 12 * H, status: 'partial' }])
  assert.equal(forService(events, 1).length, 3)
})

test('beginnt ein Vorfall genau am Anker, ersetzt er den Anker statt einen zweiten Eintrag zur selben Zeit zu erzeugen', () => {
  const events = build([{ serviceIds: [1], from: A, to: A + 2 * H, status: 'partial' }])
  assert.deepEqual(forService(events, 1), [[0, 'partial'], [2 * H, 'operational']])
})
