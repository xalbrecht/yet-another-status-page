import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRecipients, validateRecipients } from '@/lib/report/export/recipients'

test('parseRecipients trennt an Komma, Semikolon und Zeilenumbruch und schreibt klein', () => {
  assert.deepEqual(parseRecipients('A@x.de, b@x.de;\nc@x.de'), ['a@x.de', 'b@x.de', 'c@x.de'])
})

test('parseRecipients entfernt Duplikate und behält die Reihenfolge der ersten Nennung', () => {
  assert.deepEqual(parseRecipients('a@x.de,a@x.de, A@X.de, b@x.de'), ['a@x.de', 'b@x.de'])
})

test('parseRecipients ergibt für leere Eingaben eine leere Liste', () => {
  assert.deepEqual(parseRecipients(''), [])
  assert.deepEqual(parseRecipients(null), [])
  assert.deepEqual(parseRecipients(undefined), [])
  assert.deepEqual(parseRecipients(' ,; '), [])
})

test('validateRecipients akzeptiert leeren Text und gültige Adressen', () => {
  assert.equal(validateRecipients(''), true)
  assert.equal(validateRecipients(null), true)
  assert.equal(validateRecipients('a@x.de, b@x.de'), true)
  assert.equal(validateRecipients('a@x.de\nb@sub.x.de'), true)
})

test('validateRecipients nennt den ersten ungültigen Eintrag', () => {
  const missingSeparator = validateRecipients('a@x.de b@x.de')
  assert.equal(typeof missingSeparator, 'string')
  assert.ok((missingSeparator as string).includes('a@x.de b@x.de'))
  const noAt = validateRecipients('a@x.de, kein-at')
  assert.equal(typeof noAt, 'string')
  assert.ok((noAt as string).includes('kein-at'))
})
