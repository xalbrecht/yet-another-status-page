import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyIncident, summarizeClassification } from '@/lib/incident-classification'

const boilerplate = 'Unser Team arbeitet an der Wiederherstellung des gewohnten Leistungsniveaus.'

test('Titel mit Wartung ist Wartung, auch wenn der Text Performance nennt', () => {
  assert.deepEqual(
    classifyIncident({
      title: 'Nichtverfügbarkeit des Services TeVIS aufgrund von Wartungsarbeiten',
      messages: ['Die Performance kann danach schwanken.'],
    }),
    { status: 'maintenance', sure: true },
  )
})

test('Hinweis hat keine Auswirkung, auch mit Großschreibung, führendem Leerzeichen und ohne Text', () => {
  assert.deepEqual(
    classifyIncident({ title: 'Hinweis: Abruf der Lichtbilder aus der Fotocloud von e-passtransfer', messages: [] }),
    { status: 'none', sure: true },
  )
  assert.deepEqual(classifyIncident({ title: ' HINWEIS: Test', messages: [] }), { status: 'none', sure: true })
})

test('Performance im Text macht aus „teilweiser Ausfall“ Eingeschränkt', () => {
  assert.deepEqual(
    classifyIncident({
      title: 'Erstmeldung - teilweiser Ausfall des Services Nova AVA',
      messages: ['Aktuell kann es in NOVA AVA zu Performanceproblemen, d.h. längeren Wartezeiten (z.B. beim Abruf von PDFs) kommen.'],
    }),
    { status: 'degraded', sure: true },
  )
})

test('Performance im Text gilt auch bei „Vollständiger Serviceausfall“ (Entscheidung vom 11.11.2026)', () => {
  assert.deepEqual(
    classifyIncident({ title: 'Vollständiger Serviceausfall von Advis', messages: ['Es kommt zu Performance-Einbußen.'] }),
    { status: 'degraded', sure: true },
  )
})

test('Vollständiger Serviceausfall ohne Stichwort ist Schwerer Ausfall', () => {
  assert.deepEqual(
    classifyIncident({ title: 'Vollständiger Serviceausfall Exchange', messages: ['Der Dienst ist nicht erreichbar.'] }),
    { status: 'major', sure: true },
  )
})

test('Teilweiser Ausfall ist ein sicherer Teilausfall', () => {
  assert.deepEqual(classifyIncident({ title: 'Teilweiser Ausfall des Services beBPo', messages: [] }), {
    status: 'partial',
    sure: true,
  })
})

test('Störung ohne klares Merkmal ist ein unsicherer Teilausfall, „Leistungsniveau“ aus der Vorlage zählt nicht', () => {
  assert.deepEqual(classifyIncident({ title: 'Störung Autista - Analysephase', messages: [boilerplate] }), {
    status: 'partial',
    sure: false,
  })
})

test('Zusammenfassung zählt unsichere Vorfälle und Vorfälle ohne Dienst', () => {
  assert.deepEqual(
    summarizeClassification([
      { title: 'Störung Autista - Analysephase', messages: [], serviceCount: 1 },
      { title: 'Nichtverfügbarkeit … Wartungsarbeiten', messages: [], serviceCount: 0 },
      { title: 'Hinweis: Test', messages: [], serviceCount: 0 },
    ]),
    { unsure: 1, withoutService: 2 },
  )
})

test('Einordnung von Hand gilt immer und zählt als eindeutig', () => {
  assert.deepEqual(
    classifyIncident({ title: 'Störung Autista - Analysephase', messages: [boilerplate], availabilityClass: 'major' }),
    { status: 'major', sure: true },
  )
  assert.deepEqual(
    classifyIncident({ title: 'Vollständiger Serviceausfall X', messages: [], availabilityClass: 'none' }),
    { status: 'none', sure: true },
  )
})

test('Einordnung von Hand gewinnt gegen Wartung im Titel und gegen Stichwörter im Text', () => {
  assert.deepEqual(
    classifyIncident({ title: 'Nichtverfügbarkeit des Services X aufgrund von Wartungsarbeiten', messages: [], availabilityClass: 'degraded' }),
    { status: 'degraded', sure: true },
  )
  assert.deepEqual(
    classifyIncident({ title: 'Teilweiser Ausfall X', messages: ['Es gibt Performance-Probleme.'], availabilityClass: 'partial' }),
    { status: 'partial', sure: true },
  )
})

test('Automatisch und fehlender Wert verhalten sich wie bisher', () => {
  const input = { title: 'Störung Autista - Analysephase', messages: [boilerplate] }
  assert.deepEqual(classifyIncident({ ...input, availabilityClass: 'auto' }), { status: 'partial', sure: false })
  assert.deepEqual(classifyIncident({ ...input, availabilityClass: null }), { status: 'partial', sure: false })
  assert.deepEqual(classifyIncident(input), { status: 'partial', sure: false })
})

test('Zusammenfassung zählt Vorfälle mit Einordnung von Hand nicht als unsicher', () => {
  assert.deepEqual(
    summarizeClassification([
      { title: 'Störung Autista - Analysephase', messages: [], serviceCount: 1, availabilityClass: 'partial' },
      { title: 'Störung Exchange - Analysephase', messages: [], serviceCount: 1 },
    ]),
    { unsure: 1, withoutService: 0 },
  )
})
