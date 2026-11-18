import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fillUpdateTemplate, formatScheduleValue, idsOf, isNewUpdate, siblingPath, templatesForStatus, templateUses, type UpdateTemplate } from '@/lib/update-template'

const template = (over: Partial<UpdateTemplate> = {}): UpdateTemplate => ({
  id: 1,
  name: 'Ursache gefunden',
  status: 'identified',
  body: 'Betroffen: {{services}} ({{group}}), Auswirkung: {{impact}}. Mehr: {{link}}',
  smsBody: 'Ursache bekannt: {{services}}. {{link}}',
  ntfyBody: null,
  ...over,
})

test('templatesForStatus liefert nur Vorlagen des Status, nach Name sortiert', () => {
  const list = [template({ id: 1, name: 'B' }), template({ id: 2, name: 'A' }), template({ id: 3, status: 'resolved' })]
  assert.deepEqual(templatesForStatus(list, 'identified').map((t) => t.id), [2, 1])
  assert.deepEqual(templatesForStatus(list, 'monitoring'), [])
  assert.deepEqual(templatesForStatus(list, undefined), [])
})

test('fillUpdateTemplate ersetzt Dienste, Gruppe und Auswirkung, lässt {{link}} stehen', () => {
  const texts = fillUpdateTemplate(template(), { serviceNames: ['Mail', 'Postfach'], groupNames: ['Kommunikation'], impact: 'Teilausfall', locale: 'de-DE' })
  assert.equal(texts.message, 'Betroffen: Mail und Postfach (Kommunikation), Auswirkung: Teilausfall. Mehr: {{link}}')
  assert.equal(texts.smsBody, 'Ursache bekannt: Mail und Postfach. {{link}}')
  assert.equal(texts.ntfyBody, '')
})

test('fillUpdateTemplate ohne Dienste macht den Platzhalter leer', () => {
  const texts = fillUpdateTemplate(template(), { serviceNames: [], groupNames: [], impact: '', locale: 'de-DE' })
  assert.equal(texts.message, 'Betroffen:  (), Auswirkung: . Mehr: {{link}}')
})

test('idsOf liest Kennungen und Objekte, ignoriert alles andere', () => {
  assert.deepEqual(idsOf([1, '2', { id: 3 }, { value: 4 }, null, 'x']), [1, 2, 3, 4])
  assert.deepEqual(idsOf(undefined), [])
})

test('siblingPath ersetzt den letzten Teil des Pfades', () => {
  assert.equal(siblingPath('updates.2.message', 'smsBody'), 'updates.2.smsBody')
})

test('isNewUpdate: gespeicherte Kennungen gelten nicht als neu', () => {
  const saved = new Set(['a1', 'a2'])
  assert.equal(isNewUpdate('a1', saved), false)
  assert.equal(isNewUpdate('zz', saved), true)
  assert.equal(isNewUpdate(undefined, saved), true)
})

test('fillUpdateTemplate ersetzt Beginn und Ende einer Wartung', () => {
  const maintenance = template({ body: 'Wartung von {{start}} bis {{end}}: {{services}}', smsBody: null })
  const texts = fillUpdateTemplate(maintenance, { serviceNames: ['Mail'], groupNames: [], start: 'Mi., 25. Nov., 22:00 MEZ', end: '', locale: 'de-DE' })
  assert.equal(texts.message, 'Wartung von Mi., 25. Nov., 22:00 MEZ bis : Mail')
})

test('templateUses erkennt einen Platzhalter in allen Texten', () => {
  assert.equal(templateUses(template({ body: 'Ende: {{end}}' }), 'end'), true)
  assert.equal(templateUses(template({ body: 'x', smsBody: 'bis {{end}}' }), 'end'), true)
  assert.equal(templateUses(template({ body: 'x', smsBody: null, ntfyBody: null }), 'end'), false)
})

test('formatScheduleValue nutzt Zeitzone und Sprache, ungültige Werte ergeben leer', () => {
  assert.match(formatScheduleValue('2026-11-25T21:00:00.000Z', 'de-DE', 'Europe/Berlin'), /22:00/)
  assert.equal(formatScheduleValue(null, 'de-DE', 'Europe/Berlin'), '')
  assert.equal(formatScheduleValue('kein Datum', 'de-DE', 'Europe/Berlin'), '')
  assert.match(formatScheduleValue('2026-11-25T21:00:00.000Z', 'de-DE', 'Kein/Ort'), /21:00|9:00 PM/)
})
