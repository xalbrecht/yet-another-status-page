import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkMaintenanceInput, fillMaintenanceTemplate, missingMaintenanceFields, startIsInPast, zonedLocalToUtc } from '@/lib/maintenance-draft'

test('zonedLocalToUtc rechnet die Wanduhr der Zeitzone in UTC um (Winter- und Sommerzeit)', () => {
  assert.equal(zonedLocalToUtc('2026-11-25T22:00', 'Europe/Berlin'), '2026-11-25T21:00:00.000Z')
  assert.equal(zonedLocalToUtc('2026-07-01T22:00', 'Europe/Berlin'), '2026-07-01T20:00:00.000Z')
  assert.equal(zonedLocalToUtc('2026-11-25T22:00', 'UTC'), '2026-11-25T22:00:00.000Z')
  assert.equal(zonedLocalToUtc('2026-11-25T22:00', 'America/New_York'), '2026-11-26T03:00:00.000Z')
})

test('zonedLocalToUtc lehnt ungültige Eingaben und Zeitzonen ab', () => {
  assert.equal(zonedLocalToUtc('', 'UTC'), null)
  assert.equal(zonedLocalToUtc('25.11.2026 22:00', 'UTC'), null)
  assert.equal(zonedLocalToUtc('2026-02-31T10:00', 'UTC'), null)
  assert.equal(zonedLocalToUtc('2026-11-25T22:00', 'Kein/Ort'), null)
})

test('fillMaintenanceTemplate ersetzt Dienste, Gruppe, Beginn und Ende, lässt {{link}} stehen', () => {
  const texts = fillMaintenanceTemplate(
    { title: 'Wartung {{services}}', body: '{{start}} bis {{end}}. {{link}}', smsBody: 'Wartung {{group}}', ntfyBody: null },
    { services: 'Mail', group: 'Kommunikation', start: 'A', end: '' },
  )
  assert.deepEqual(texts, { title: 'Wartung Mail', body: 'A bis . {{link}}', smsBody: 'Wartung Kommunikation', ntfyBody: '' })
})

const draft = {
  groupId: '1',
  serviceIds: ['1'],
  startUtc: '2026-11-25T21:00:00.000Z',
  endUtc: null as string | null,
  endGiven: false,
  templateChoice: '3' as string | null,
  texts: { title: 'T', body: 'B', smsBody: '', ntfyBody: '' },
}

test('missingMaintenanceFields: Ende ist optional, vor dem Beginn aber ungültig', () => {
  assert.deepEqual(missingMaintenanceFields(draft), [])
  assert.deepEqual(missingMaintenanceFields({ ...draft, endGiven: true, endUtc: '2026-11-25T20:00:00.000Z' }), ['end-before-start'])
  assert.deepEqual(missingMaintenanceFields({ ...draft, endGiven: true, endUtc: null }), ['end-before-start'])
  assert.deepEqual(missingMaintenanceFields({ ...draft, endGiven: true, endUtc: '2026-11-26T01:00:00.000Z' }), [])
})

test('missingMaintenanceFields nennt Gruppe, Dienste, Beginn, Vorlage und Texte', () => {
  assert.deepEqual(missingMaintenanceFields({ ...draft, groupId: '', startUtc: null, templateChoice: null }), ['group', 'start', 'template'])
  assert.deepEqual(missingMaintenanceFields({ ...draft, serviceIds: [] }), ['services'])
  assert.deepEqual(missingMaintenanceFields({ ...draft, texts: { ...draft.texts, title: ' ', body: '' } }), ['title', 'body'])
})

test('startIsInPast', () => {
  assert.equal(startIsInPast('2026-11-25T21:00:00.000Z', Date.parse('2026-11-26T00:00:00Z')), true)
  assert.equal(startIsInPast('2026-11-25T21:00:00.000Z', Date.parse('2026-11-25T00:00:00Z')), false)
  assert.equal(startIsInPast(null, 0), false)
})

test('checkMaintenanceInput nimmt eine vollständige Eingabe an, Ende ist optional', () => {
  const ok = checkMaintenanceInput({ title: 'T', message: 'M', serviceIds: [1, 1, 2], start: '2026-11-25T21:00:00.000Z', smsBody: 'S' })
  assert.deepEqual(ok, { ok: true, value: { title: 'T', message: 'M', serviceIds: [1, 2], start: '2026-11-25T21:00:00.000Z', smsBody: 'S' } })
  const withEnd = checkMaintenanceInput({ title: 'T', message: 'M', serviceIds: [1], start: '2026-11-25T21:00:00.000Z', end: '2026-11-26T01:00:00.000Z' })
  assert.equal(withEnd.ok && withEnd.value.end, '2026-11-26T01:00:00.000Z')
})

test('checkMaintenanceInput nennt die fehlerhaften Felder', () => {
  assert.deepEqual(checkMaintenanceInput({}), { ok: false, errors: ['title', 'message', 'start', 'serviceIds'] })
  const bad = checkMaintenanceInput({ title: 'T', message: 'M', serviceIds: [1], start: '2026-11-25T21:00:00.000Z', end: '2026-11-25T20:00:00.000Z' })
  assert.deepEqual(bad, { ok: false, errors: ['end'] })
  assert.deepEqual(checkMaintenanceInput({ title: 'T', message: 'M', serviceIds: [0], start: 'kein Datum' }), { ok: false, errors: ['start', 'serviceIds'] })
})
