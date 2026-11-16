import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkTemplateText,
  formatServiceList,
  isStatusOfKind,
  placeholdersIn,
  PLACEHOLDERS,
  renderTemplate,
  STATUS_VALUES,
  unknownPlaceholders,
} from '@/lib/message-templates'

test('placeholdersIn nennt jeden Platzhalter einmal in der Reihenfolge des Auftretens, auch mit Leerzeichen', () => {
  assert.deepEqual(placeholdersIn('Betroffen: {{services}} in {{ group }}. {{services}} {{link}}'), ['services', 'group', 'link'])
  assert.deepEqual(placeholdersIn('kein Platzhalter, auch nicht {einfach} oder {{}}'), [])
})

test('unknownPlaceholders erlaubt je Art andere Namen', () => {
  assert.deepEqual(unknownPlaceholders('{{services}} {{impact}} {{link}} {{group}}', 'incident'), [])
  assert.deepEqual(unknownPlaceholders('{{start}} {{end}}', 'incident'), ['start', 'end'])
  assert.deepEqual(unknownPlaceholders('{{start}} {{end}} {{services}} {{link}}', 'maintenance'), [])
  assert.deepEqual(unknownPlaceholders('{{impact}} {{dienste}}', 'maintenance'), ['impact', 'dienste'])
})

test('jeder erlaubte Platzhalter hat nur Buchstaben, damit die Schreibweise {{name}} ihn erfasst', () => {
  for (const names of Object.values(PLACEHOLDERS)) {
    for (const name of names) assert.match(name, /^\w+$/)
  }
})

test('renderTemplate ersetzt die übergebenen Platzhalter und lässt die übrigen stehen', () => {
  const text = 'Störung: {{services}} ({{group}}). Mehr: {{link}}'
  assert.equal(renderTemplate(text, { services: 'Mail und Web', group: 'Kommunikation' }), 'Störung: Mail und Web (Kommunikation). Mehr: {{link}}')
  assert.equal(renderTemplate(text, { services: 'A', group: 'G', link: 'https://x.example/i/1' }), 'Störung: A (G). Mehr: https://x.example/i/1')
})

test('renderTemplate ersetzt alle Vorkommen, auch mit Leerzeichen in den Klammern, und lässt Sonderzeichen im Wert unberührt', () => {
  assert.equal(renderTemplate('{{services}} / {{ services }}', { services: '$& <b>' }), '$& <b> / $& <b>')
})

test('ein leerer Wert ersetzt den Platzhalter durch nichts', () => {
  assert.equal(renderTemplate('Gruppe: {{group}}.', { group: '' }), 'Gruppe: .')
})

test('formatServiceList nennt einen, zwei und drei Dienste nach den Regeln der Sprache', () => {
  assert.equal(formatServiceList([], 'de-DE'), '')
  assert.equal(formatServiceList(['Mail'], 'de-DE'), 'Mail')
  assert.equal(formatServiceList(['Mail', 'Web'], 'de-DE'), 'Mail und Web')
  assert.equal(formatServiceList(['Mail', 'Web', 'DNS'], 'de-DE'), 'Mail, Web und DNS')
  assert.equal(formatServiceList(['Mail', 'Web', 'DNS'], 'en-US'), 'Mail, Web, and DNS')
})

test('eine unbekannte Sprache fällt auf eine einfache Aufzählung zurück, statt zu werfen', () => {
  assert.doesNotThrow(() => formatServiceList(['A', 'B'], 'kein-locale-!!'))
})

test('die Statuslisten kommen aus den Störungen und Wartungen', () => {
  assert.deepEqual([...STATUS_VALUES.incident], ['investigating', 'identified', 'monitoring', 'resolved'])
  assert.deepEqual([...STATUS_VALUES.maintenance], ['upcoming', 'in_progress', 'completed', 'cancelled'])
  assert.equal(isStatusOfKind('incident', 'resolved'), true)
  assert.equal(isStatusOfKind('incident', 'completed'), false)
  assert.equal(isStatusOfKind('maintenance', 'completed'), true)
  assert.equal(isStatusOfKind('maintenance', 'investigating'), false)
})

test('checkTemplateText: Pflichttext darf nicht leer sein, ein optionaler schon', () => {
  assert.deepEqual(checkTemplateText('', { required: true, kind: 'incident' }), { ok: false, problem: 'required' })
  assert.deepEqual(checkTemplateText('   ', { required: true, kind: 'incident' }), { ok: false, problem: 'required' })
  assert.deepEqual(checkTemplateText(undefined, { required: false, kind: 'incident' }), { ok: true })
  assert.deepEqual(checkTemplateText(null, { required: false, kind: 'incident' }), { ok: true })
})

test('checkTemplateText: die Längengrenze gilt mit dem Wert genau an der Grenze als erlaubt', () => {
  assert.deepEqual(checkTemplateText('x'.repeat(320), { required: false, kind: 'incident', maxLength: 320 }), { ok: true })
  assert.deepEqual(checkTemplateText('x'.repeat(321), { required: false, kind: 'incident', maxLength: 320 }), { ok: false, problem: 'too-long', max: 320 })
})

test('checkTemplateText: unbekannte Platzhalter werden mit den erlaubten genannt', () => {
  const result = checkTemplateText('{{dienste}} {{services}} {{start}}', { required: true, kind: 'incident' })
  assert.deepEqual(result, { ok: false, problem: 'unknown-placeholder', names: ['dienste', 'start'], allowed: PLACEHOLDERS.incident })
  assert.deepEqual(checkTemplateText('{{start}} {{end}}', { required: true, kind: 'maintenance' }), { ok: true })
})
