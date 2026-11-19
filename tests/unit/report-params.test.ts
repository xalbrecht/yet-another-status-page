import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseReportParams, reportHref, reportTabHrefs, selectionQuery } from '@/lib/report/params'

test('ohne Angaben gelten die Standardwerte', () => {
  assert.deepEqual(parseReportParams({}), {
    period: undefined,
    from: undefined,
    to: undefined,
    group: undefined,
    view: 'overall',
    calc: 'whole',
    maintenance: 'A',
    maintenanceAdditional: 'A',
    showMaintenance: true,
    topN: 5,
    ended: false,
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

test('reportTabHrefs behält die Gruppe, solange sie gültig ist', () => {
  assert.deepEqual(reportTabHrefs({ view: 'groups', group: '7', period: '2026-10' }, false), {
    overall: '/admin/verfuegbarkeitsbericht?group=7&period=2026-10&view=overall',
    groups: '/admin/verfuegbarkeitsbericht?group=7&period=2026-10&view=groups',
  })
})

test('reportTabHrefs lässt eine ungültige Gruppe weg, damit die Tabs keine Sackgasse sind', () => {
  assert.deepEqual(reportTabHrefs({ view: 'groups', group: '99999999', period: '2026-10' }, true), {
    overall: '/admin/verfuegbarkeitsbericht?period=2026-10&view=overall',
    groups: '/admin/verfuegbarkeitsbericht?period=2026-10&view=groups',
  })
})

test('Schalter „Beendete Dienste einbeziehen“: nur ended=true schaltet ein, Vorgabe aus', () => {
  assert.equal(parseReportParams({}).ended, false)
  assert.equal(parseReportParams({ ended: 'true' }).ended, true)
  assert.equal(parseReportParams({ ended: 'false' }).ended, false)
  assert.equal(parseReportParams({ ended: 'ja' }).ended, false)
})

test('selectionQuery gibt den Schalter an Export und Versand weiter', () => {
  assert.match(selectionQuery({ ended: 'true', period: '2026-10' }), /(^|&)ended=true(&|$)/)
  assert.doesNotMatch(selectionQuery({ period: '2026-10' }), /ended/)
})

test('Rechenart der zusätzlichen Wartung: Vorgabe A, unabhängig von der Rechenart im Wartungsfenster', () => {
  assert.equal(parseReportParams({}).maintenanceAdditional, 'A')
  assert.equal(parseReportParams({ maintenanceAdditional: 'X' }).maintenanceAdditional, 'A')
  assert.equal(parseReportParams({ maintenanceAdditional: 'b' }).maintenanceAdditional, 'B')
  assert.equal(parseReportParams({ maintenanceAdditional: 'C' }).maintenanceAdditional, 'C')
  const both = parseReportParams({ maintenance: 'A', maintenanceAdditional: 'B' })
  assert.deepEqual([both.maintenance, both.maintenanceAdditional], ['A', 'B'])
})

test('selectionQuery gibt die Rechenart der zusätzlichen Wartung an Export und Versand weiter', () => {
  assert.match(selectionQuery({ maintenanceAdditional: 'B' }), /(^|&)maintenanceAdditional=B(&|$)/)
})
