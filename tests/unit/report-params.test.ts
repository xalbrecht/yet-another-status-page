import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseReportParams } from '@/lib/report/params'

test('ohne Angaben gelten die Standardwerte', () => {
  assert.deepEqual(parseReportParams({}), {
    period: undefined,
    from: undefined,
    to: undefined,
    group: undefined,
    calc: 'whole',
    maintenance: 'A',
    showMaintenance: true,
    topN: 5,
  })
})

test('Anzahl der schwächsten Dienste wird auf 3 bis 10 begrenzt, Unsinn ergibt 5', () => {
  assert.equal(parseReportParams({ topN: '99' }).topN, 10)
  assert.equal(parseReportParams({ topN: '1' }).topN, 3)
  assert.equal(parseReportParams({ topN: '7' }).topN, 7)
  assert.equal(parseReportParams({ topN: 'viele' }).topN, 5)
})

test('Wartungsart, Rechenart und Wartungszeile', () => {
  assert.equal(parseReportParams({ maintenance: 'X' }).maintenance, 'A')
  assert.equal(parseReportParams({ maintenance: 'b' }).maintenance, 'B')
  assert.equal(parseReportParams({ maintenance: 'C' }).maintenance, 'C')
  assert.equal(parseReportParams({ calc: 'foo' }).calc, 'whole')
  assert.equal(parseReportParams({ calc: 'monthly' }).calc, 'monthly')
  assert.equal(parseReportParams({ showMaintenance: 'false' }).showMaintenance, false)
  assert.equal(parseReportParams({ showMaintenance: 'true' }).showMaintenance, true)
})

test('mehrfach angegebene und leere Werte', () => {
  assert.equal(parseReportParams({ period: ['2026-10', '2026-09'] }).period, '2026-10')
  assert.equal(parseReportParams({ group: '  ' }).group, undefined)
})
