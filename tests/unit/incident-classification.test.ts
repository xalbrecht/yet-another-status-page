import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyIncident, normalizeRules, summarizeClassification, type ClassificationRule } from '@/lib/incident-classification'

// Beispielregeln einer deutschen Installation, Reihenfolge wie in den Einstellungen
const rules: ClassificationRule[] = [
  { field: 'title', match: 'contains', words: 'wartung', classification: 'maintenance' },
  { field: 'title', match: 'starts', words: 'hinweis', classification: 'none' },
  { field: 'updates', match: 'contains', words: 'performance, ladezeit, wartezeit, langsam', classification: 'degraded' },
  { field: 'title', match: 'starts', words: 'vollständiger serviceausfall', classification: 'major' },
  { field: 'title', match: 'starts', words: 'teilweiser ausfall', classification: 'partial' },
]

const boilerplate = 'Unser Team arbeitet an der Wiederherstellung des gewohnten Leistungsniveaus.'

test('ohne Regeln zählt jeder Vorfall als unsicherer Teilausfall', () => {
  assert.deepEqual(classifyIncident({ title: 'Vollständiger Serviceausfall von Dienst A', messages: [] }), { status: 'partial', sure: false })
  assert.deepEqual(classifyIncident({ title: 'Major outage of service A', messages: [] }, []), { status: 'partial', sure: false })
})

test('die erste passende Regel entscheidet: Wartung im Titel vor Stichwort im Text', () => {
  assert.deepEqual(
    classifyIncident({ title: 'Nichtverfügbarkeit von Dienst A aufgrund von Wartungsarbeiten', messages: ['Die Performance kann danach schwanken.'] }, rules),
    { status: 'maintenance', sure: true },
  )
})

test('„beginnt mit“ beachtet weder Großschreibung noch führende Leerzeichen', () => {
  assert.deepEqual(classifyIncident({ title: 'Hinweis: Abruf der Bilder', messages: [] }, rules), { status: 'none', sure: true })
  assert.deepEqual(classifyIncident({ title: ' HINWEIS: Test', messages: [] }, rules), { status: 'none', sure: true })
  // „Hinweis“ mitten im Titel passt nicht zu „beginnt mit“
  assert.deepEqual(classifyIncident({ title: 'Störung, siehe Hinweis', messages: [] }, rules), { status: 'partial', sure: false })
})

test('ein Stichwort im Text der Aktualisierungen gilt vor einer späteren Titelregel', () => {
  assert.deepEqual(
    classifyIncident({ title: 'Vollständiger Serviceausfall von Dienst A', messages: ['Erste Meldung.', 'Es kommt zu längeren Wartezeiten.'] }, rules),
    { status: 'degraded', sure: true },
  )
})

test('Titelregeln ohne Stichwort im Text', () => {
  assert.deepEqual(classifyIncident({ title: 'Vollständiger Serviceausfall Dienst B', messages: ['Der Dienst ist nicht erreichbar.'] }, rules), { status: 'major', sure: true })
  assert.deepEqual(classifyIncident({ title: 'Teilweiser Ausfall von Dienst C', messages: [] }, rules), { status: 'partial', sure: true })
})

test('passt keine Regel, ist es ein unsicherer Teilausfall (ein Wort, das nicht in den Regeln steht, zählt nicht)', () => {
  assert.deepEqual(classifyIncident({ title: 'Störung Dienst D - Analysephase', messages: [boilerplate] }, rules), { status: 'partial', sure: false })
})

test('geänderte Reihenfolge ändert das Ergebnis', () => {
  const swapped = [rules[3], rules[2], rules[0], rules[1], rules[4]]
  assert.deepEqual(
    classifyIncident({ title: 'Vollständiger Serviceausfall von Dienst A', messages: ['Es kommt zu längeren Wartezeiten.'] }, swapped),
    { status: 'major', sure: true },
  )
})

test('Regeln in einer anderen Sprache', () => {
  const english: ClassificationRule[] = [{ field: 'title', match: 'starts', words: 'major outage', classification: 'major' }]
  assert.deepEqual(classifyIncident({ title: 'Major outage of service A', messages: [] }, english), { status: 'major', sure: true })
})

test('Einordnung von Hand gilt immer und zählt als eindeutig, auch gegen passende Regeln', () => {
  assert.deepEqual(classifyIncident({ title: 'Störung Dienst D', messages: [boilerplate], availabilityClass: 'major' }, rules), { status: 'major', sure: true })
  assert.deepEqual(classifyIncident({ title: 'Vollständiger Serviceausfall X', messages: [], availabilityClass: 'none' }, rules), { status: 'none', sure: true })
  assert.deepEqual(
    classifyIncident({ title: 'Nichtverfügbarkeit von Dienst A aufgrund von Wartungsarbeiten', messages: [], availabilityClass: 'degraded' }, rules),
    { status: 'degraded', sure: true },
  )
})

test('„Automatisch“ und ein fehlender Wert nutzen die Regeln', () => {
  const input = { title: 'Teilweiser Ausfall von Dienst C', messages: [] }
  assert.deepEqual(classifyIncident({ ...input, availabilityClass: 'auto' }, rules), { status: 'partial', sure: true })
  assert.deepEqual(classifyIncident({ ...input, availabilityClass: null }, rules), { status: 'partial', sure: true })
})

test('Zusammenfassung zählt unsichere Vorfälle und Vorfälle ohne Dienst', () => {
  assert.deepEqual(
    summarizeClassification(
      [
        { title: 'Störung Dienst D - Analysephase', messages: [], serviceCount: 1 },
        { title: 'Nichtverfügbarkeit … Wartungsarbeiten', messages: [], serviceCount: 0 },
        { title: 'Hinweis: Test', messages: [], serviceCount: 0 },
        { title: 'Störung Dienst E', messages: [], serviceCount: 1, availabilityClass: 'partial' },
      ],
      rules,
    ),
    { unsure: 1, withoutService: 2 },
  )
})

test('normalizeRules übernimmt gültige Zeilen der Einstellungen und lässt den Rest weg', () => {
  assert.deepEqual(
    normalizeRules([
      { id: 'a', field: 'title', match: 'starts', words: ' Hinweis ', classification: 'none' },
      { field: 'updates', match: 'contains', words: 'langsam', classification: 'degraded' },
      { field: 'title', match: 'starts', words: ' , ', classification: 'none' },
      { field: 'body', match: 'starts', words: 'x', classification: 'none' },
      { field: 'title', match: 'regex', words: 'x', classification: 'none' },
      { field: 'title', match: 'starts', words: 'x', classification: 'auto' },
      null,
    ]),
    [
      { field: 'title', match: 'starts', words: ' Hinweis ', classification: 'none' },
      { field: 'updates', match: 'contains', words: 'langsam', classification: 'degraded' },
    ],
  )
  assert.deepEqual(normalizeRules(undefined), [])
  assert.deepEqual(normalizeRules('x'), [])
})
