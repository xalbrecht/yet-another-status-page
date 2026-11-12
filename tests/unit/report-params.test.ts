import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseReportParams, reportHref } from '@/lib/report/params'

test('ohne Angaben gelten die Standardwerte', () => {
  assert.deepEqual(parseReportParams({}), {
    period: undefined,
    from: undefined,
    to: undefined,
    group: undefined,
    view: 'overall',
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

test('view erkennt nur „groups“, sonst gilt die Gesamtansicht', () => {
  assert.equal(parseReportParams({ view: 'groups' }).view, 'groups')
  assert.equal(parseReportParams({}).view, 'overall')
  assert.equal(parseReportParams({ view: 'x' }).view, 'overall')
})

test('reportHref baut die Adresse aus der Auswahl und den Änderungen, Schlüssel alphabetisch', () => {
  assert.equal(
    reportHref({ period: '2026-10', calc: 'monthly' }, { view: 'groups', group: '7' }),
    '/admin/verfuegbarkeitsbericht?calc=monthly&group=7&period=2026-10&view=groups',
  )
})

test('reportHref entfernt einen Wert mit undefined und lässt leere Werte weg', () => {
  assert.equal(reportHref({ group: '7' }, { group: undefined }), '/admin/verfuegbarkeitsbericht')
  assert.equal(reportHref({ period: ['2026-10', '2026-09'], from: '' }, {}), '/admin/verfuegbarkeitsbericht?period=2026-10')
})
