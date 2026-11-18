import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatZonedDateTime } from '@/lib/zoned-format'

test('formatZonedDateTime nutzt die Zeitzone und nennt sie', () => {
  const text = formatZonedDateTime('2026-11-25T21:00:00.000Z', 'de-DE', 'Europe/Berlin')
  assert.match(text, /25\.11\.2026/)
  assert.match(text, /22:00/)
  assert.match(text, /MEZ|GMT\+1/)
})

test('formatZonedDateTime: Sommerzeit, andere Zone', () => {
  assert.match(formatZonedDateTime('2026-07-01T20:00:00.000Z', 'de-DE', 'Europe/Berlin'), /22:00/)
  assert.match(formatZonedDateTime('2026-11-25T21:00:00.000Z', 'en-US', 'UTC'), /9:00\s?PM/)
})

test('formatZonedDateTime: ungültiger Zeitpunkt ergibt leer, unbekannte Zone fällt auf UTC zurück', () => {
  assert.equal(formatZonedDateTime('kein Datum', 'de-DE', 'UTC'), '')
  assert.match(formatZonedDateTime('2026-11-25T21:00:00.000Z', 'de-DE', 'Kein/Ort'), /9:00\s?PM|21:00/)
})
