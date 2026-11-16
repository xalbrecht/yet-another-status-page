import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { ReportData } from '@/lib/report/aggregate'
import type { LoadedReport } from '@/lib/report/load'
import { parseReportParams } from '@/lib/report/params'
import { reportViewState, searchForLoad } from '@/lib/report/view-state'
import { makeReportData } from './export-fixtures'

// Zustand der Berichtsseite (index.tsx): Gruppe in Adresse, Formular und Tabs
const loaded = (query: Record<string, string>, data: ReportData = makeReportData(), groupFromReport?: string): LoadedReport => ({
  ok: true,
  data,
  params: { ...parseReportParams(query), ...(groupFromReport ? { group: groupFromReport } : {}) },
  period: { key: '2026-10', label: 'Oktober 2026', start: 0, end: 1, partial: false },
})

test('searchForLoad: im Gesamtbericht entfällt die Gruppe der Adresse, in den Gruppenberichten bleibt sie', () => {
  const search = { view: 'overall', group: '7', period: '2026-10' }
  assert.deepEqual(searchForLoad(parseReportParams(search), search), { view: 'overall', group: undefined, period: '2026-10' })
  const groups = { view: 'groups', group: '7' }
  assert.equal(searchForLoad(parseReportParams(groups), groups), groups)
})

test('Gesamtbericht: das Formular behält die Gruppe der Adresse, der Bericht lädt sie nicht', () => {
  const query = { group: '7' }
  const state = reportViewState(parseReportParams(query), loaded({ ...query }, makeReportData(), undefined))
  assert.equal(state.controlParams.group, '7')
  assert.equal(state.groupInvalid, false)
  assert.equal(state.exportable, true)
})

test('Gruppenberichte ohne Gruppe in der Adresse: das Formular trägt die vorgewählte Gruppe weiter', () => {
  const query = { view: 'groups' }
  const state = reportViewState(parseReportParams(query), loaded(query, makeReportData(), '5'))
  assert.equal(state.controlParams.group, '5')
})

test('ungültige Gruppe (Bericht meldet Fehler): keine Gruppe in Formular und Tabs, nichts exportierbar', () => {
  const query = { view: 'groups', group: '99' }
  const state = reportViewState(parseReportParams(query), loaded(query, makeReportData({ error: 'Die gewählte Gruppe wurde nicht gefunden.' })))
  assert.equal(state.groupInvalid, true)
  assert.equal(state.controlParams.group, undefined)
  assert.equal(state.reportParams.group, undefined)
  assert.equal(state.exportable, false)
})

test('Bericht nicht geladen: Parameter der Adresse, nichts exportierbar', () => {
  const requested = parseReportParams({ view: 'groups', group: '3' })
  const state = reportViewState(requested, { ok: false, error: 'Der Zeitraum ist ungültig.' })
  assert.equal(state.exportable, false)
  assert.equal(state.groupInvalid, false)
  assert.equal(state.controlParams.group, '3')
})
