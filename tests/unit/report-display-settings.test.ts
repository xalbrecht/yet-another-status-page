import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_REPORT_DISPLAY, reportDisplayOf } from '@/lib/report/display-settings'

test('ohne Einstellungen gilt die Vorgabe: Hinweis an der Zeile und zwei Felder', () => {
  assert.deepEqual(reportDisplayOf(null), DEFAULT_REPORT_DISPLAY)
  assert.deepEqual(reportDisplayOf(undefined), { heatEnded: 'label', sheetActive: 'marks' })
  assert.deepEqual(reportDisplayOf({}), { heatEnded: 'label', sheetActive: 'marks' })
})

test('beide Einstellungen werden unabhängig gelesen', () => {
  assert.deepEqual(reportDisplayOf({ reportHeatEndedStyle: 'hatch' }), { heatEnded: 'hatch', sheetActive: 'marks' })
  assert.deepEqual(reportDisplayOf({ reportSheetActiveStyle: 'hints' }), { heatEnded: 'label', sheetActive: 'hints' })
  assert.deepEqual(reportDisplayOf({ reportHeatEndedStyle: 'hatch', reportSheetActiveStyle: 'hints' }), { heatEnded: 'hatch', sheetActive: 'hints' })
})

test('unbekannte oder leere Werte ergeben die Vorgabe', () => {
  assert.deepEqual(reportDisplayOf({ reportHeatEndedStyle: 'x', reportSheetActiveStyle: null }), DEFAULT_REPORT_DISPLAY)
  assert.deepEqual(reportDisplayOf({ reportHeatEndedStyle: '', reportSheetActiveStyle: '' }), DEFAULT_REPORT_DISPLAY)
})
