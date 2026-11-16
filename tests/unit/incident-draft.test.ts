import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkIncidentInput, fillTemplate, missingFields, servicesPhrase, type DraftTexts } from '@/lib/incident-draft'

const groupPhrase = (group: string) => `alle Dienste der Gruppe ${group}`
const base = { groupName: 'Kommunikation', groupServiceCount: 3, locale: 'de-DE', groupPhrase }
const texts = (over: Partial<DraftTexts> = {}): DraftTexts => ({ title: 'T', body: 'B', smsBody: '', ntfyBody: '', ...over })

test('servicesPhrase: einzelne Dienste werden aufgezählt', () => {
  assert.equal(servicesPhrase({ ...base, selectedNames: ['E-Mail'], naming: 'list' }), 'E-Mail')
  assert.equal(servicesPhrase({ ...base, selectedNames: ['E-Mail', 'Kalender'], naming: 'list' }), 'E-Mail und Kalender')
  assert.equal(servicesPhrase({ ...base, selectedNames: ['A', 'B', 'C'], naming: 'list' }), 'A, B und C')
})

test('servicesPhrase: „alle Dienste der Gruppe“ nur, wenn wirklich alle gewählt sind und die Form gewählt ist', () => {
  assert.equal(servicesPhrase({ ...base, selectedNames: ['A', 'B', 'C'], naming: 'group' }), 'alle Dienste der Gruppe Kommunikation')
  // nicht alle gewählt: die Wahl „Gruppe“ gilt nicht
  assert.equal(servicesPhrase({ ...base, selectedNames: ['A', 'B'], naming: 'group' }), 'A und B')
  // eine Gruppe mit nur einem Dienst nennt den Dienst
  assert.equal(servicesPhrase({ ...base, groupServiceCount: 1, selectedNames: ['A'], naming: 'group' }), 'A')
})

test('fillTemplate ersetzt Dienste, Gruppe und Auswirkung und lässt {{link}} stehen', () => {
  const result = fillTemplate(
    { title: 'Störung {{services}}', body: 'Betroffen: {{services}} ({{group}}), {{impact}}. {{link}}', smsBody: '{{services}} {{link}}', ntfyBody: null },
    { services: 'A und B', group: 'Gruppe X', impact: 'Teilausfall' },
  )
  assert.deepEqual(result, {
    title: 'Störung A und B',
    body: 'Betroffen: A und B (Gruppe X), Teilausfall. {{link}}',
    smsBody: 'A und B {{link}}',
    ntfyBody: '',
  })
})

test('missingFields nennt der Reihe nach, was fehlt', () => {
  const none = { groupId: '', serviceIds: [] as string[], templateChoice: null, impact: null, texts: texts() }
  assert.deepEqual(missingFields(none), ['group', 'template', 'impact'])
  assert.deepEqual(missingFields({ ...none, groupId: '1' }), ['services', 'template', 'impact'])
  assert.deepEqual(missingFields({ ...none, groupId: '1', serviceIds: ['5'], templateChoice: 'none', texts: texts({ title: ' ', body: '' }) }), ['impact', 'title', 'body'])
  assert.deepEqual(missingFields({ groupId: '1', serviceIds: ['5'], templateChoice: '7', impact: 'partial', texts: texts() }), [])
})

test('missingFields: zu lange SMS- und ntfy-Texte sperren die Vorschau', () => {
  const ok = { groupId: '1', serviceIds: ['5'], templateChoice: '7', impact: 'partial' as const }
  assert.deepEqual(missingFields({ ...ok, texts: texts({ smsBody: 'x'.repeat(320), ntfyBody: 'x'.repeat(500) }) }), [])
  assert.deepEqual(missingFields({ ...ok, texts: texts({ smsBody: 'x'.repeat(321) }) }), ['sms-too-long'])
  assert.deepEqual(missingFields({ ...ok, texts: texts({ ntfyBody: 'x'.repeat(501) }) }), ['ntfy-too-long'])
})

test('checkIncidentInput nimmt eine vollständige Eingabe an und lässt unbekannte Felder weg', () => {
  const result = checkIncidentInput({ title: 'T', message: 'M', impact: 'partial', serviceIds: [3, 4, 3], smsBody: 'S', ntfyBody: 'N', extra: 'x' })
  assert.deepEqual(result, { ok: true, value: { title: 'T', message: 'M', impact: 'partial', serviceIds: [3, 4], smsBody: 'S', ntfyBody: 'N' } })
})

test('checkIncidentInput: SMS- und ntfy-Text sind optional und leere werden weggelassen', () => {
  const result = checkIncidentInput({ title: 'T', message: 'M', impact: 'major', serviceIds: [1], smsBody: '', ntfyBody: null })
  assert.deepEqual(result, { ok: true, value: { title: 'T', message: 'M', impact: 'major', serviceIds: [1] } })
})

test('checkIncidentInput nennt jedes ungültige Feld', () => {
  assert.deepEqual(checkIncidentInput(null), { ok: false, errors: ['title', 'message', 'impact', 'serviceIds'] })
  const bad = checkIncidentInput({ title: '  ', message: 'M', impact: 'minor', serviceIds: [] })
  assert.deepEqual(bad, { ok: false, errors: ['title', 'impact', 'serviceIds'] })
  assert.deepEqual(checkIncidentInput({ title: 'T', message: 'M', impact: 'partial', serviceIds: ['3'] }), { ok: false, errors: ['serviceIds'] })
  assert.deepEqual(checkIncidentInput({ title: 'T', message: 'M', impact: 'partial', serviceIds: [0] }), { ok: false, errors: ['serviceIds'] })
  assert.deepEqual(checkIncidentInput({ title: 'T', message: 'M', impact: 'partial', serviceIds: [1], smsBody: 'x'.repeat(321) }), { ok: false, errors: ['smsBody'] })
  assert.deepEqual(checkIncidentInput({ title: 'T', message: 'M', impact: 'partial', serviceIds: [1], ntfyBody: 'x'.repeat(501) }), { ok: false, errors: ['ntfyBody'] })
  assert.deepEqual(checkIncidentInput({ title: 'x'.repeat(301), message: 'M', impact: 'partial', serviceIds: [1] }), { ok: false, errors: ['title'] })
})

test('checkIncidentInput: nicht mehr als 200 Dienste', () => {
  const many = Array.from({ length: 201 }, (_, i) => i + 1)
  assert.deepEqual(checkIncidentInput({ title: 'T', message: 'M', impact: 'partial', serviceIds: many }), { ok: false, errors: ['serviceIds'] })
})
