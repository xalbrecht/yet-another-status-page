import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { GroupBars } from '@/components/admin/availability-report/GroupBars'
import { Heatmap } from '@/components/admin/availability-report/Heatmap'
import type { ReportData } from '@/lib/report/aggregate'
import { months, rankingRow } from './export-fixtures'

/**
 * Darstellung beendeter Dienste im Gruppenblatt (Issue #182): zwei Varianten der Wärmekarte und der Balken.
 * Das Ende des Dienstes ist der 31.10.2026 (Tagesende, Zeitzone UTC).
 */
const ENDED_AT = Date.UTC(2026, 9, 31, 23, 59, 59, 999)
const count = (markup: string, needle: string) => markup.split(needle).length - 1

const heat: ReportData['heat'] = {
  columns: months,
  rows: [
    { name: 'Gesamt', values: months.map(() => 100), total: true },
    { name: 'Laufender Dienst', values: months.map(() => 100), endedAt: null },
    { name: 'Altes Archiv', values: months.map((_, index) => (index < 10 ? 99.95 : null)), endedAt: ENDED_AT },
  ],
}
const heatMarkup = (endedStyle: 'label' | 'hatch') =>
  renderToStaticMarkup(<Heatmap heat={heat} target={99} locale="de-DE" timeZone="UTC" endedStyle={endedStyle} />)

test('Wärmekarte „label“: Zeilenüberschrift des beendeten Dienstes grau mit „beendet am“, die laufende Zeile bleibt unverändert', () => {
  const markup = heatMarkup('label')
  assert.equal(count(markup, 'availability-report__heat-ended'), 1)
  assert.ok(markup.includes('beendet am 31.10.2026'))
})

test('Wärmekarte „hatch“: keine Kennzeichnung an der Zeilenüberschrift', () => {
  const markup = heatMarkup('hatch')
  assert.equal(count(markup, 'availability-report__heat-ended'), 0)
  assert.ok(!markup.includes('beendet am'))
})

test('Wärmekarte: Monate ohne Wert sind in beiden Varianten schraffiert, die Legende nennt es', () => {
  for (const style of ['label', 'hatch'] as const) {
    const markup = heatMarkup(style)
    assert.equal(count(markup, 'availability-report__cell availability-report__cell--none'), 2, `${style}: zwei Monate ohne Wert`)
    assert.ok(markup.includes('kein Wert'), `${style}: Legende`)
  }
})

test('Wärmekarte ohne Monate ohne Wert: keine Legende dafür', () => {
  const full: ReportData['heat'] = { columns: months, rows: [{ name: 'Dienst', values: months.map(() => 100) }] }
  assert.ok(!renderToStaticMarkup(<Heatmap heat={full} target={99} locale="de-DE" />).includes('kein Wert'))
})

const rows = [
  rankingRow(1, 'Mailserver', 100, 0),
  rankingRow(2, 'Altes Archiv', 99.9, 0, { activeToday: false, endedAt: ENDED_AT }),
  rankingRow(3, 'Dokumentenablage', null, 0, { activeInPeriod: false, activeToday: false, endedAt: Date.UTC(2025, 7, 31, 23, 59, 59, 999) }),
]
const bars = (activeStyle: 'marks' | 'hints') => renderToStaticMarkup(<GroupBars rows={rows} locale="de-DE" timeZone="UTC" activeStyle={activeStyle} />)

test('Balken „marks“: in jeder Zeile zwei Felder, dazu eine Kopfzeile mit den Spaltennamen', () => {
  const markup = bars('marks')
  assert.equal(count(markup, 'availability-report__opt '), 6, 'zwei Felder in drei Zeilen')
  assert.ok(markup.includes('Aktiv im Berichtszeitraum') && markup.includes('Aktiv heute'))
  // Mailserver: ja/ja, Altes Archiv: ja/nein, Dokumentenablage: nein/nein
  assert.equal(count(markup, 'data-active="true"'), 3)
  assert.equal(count(markup, 'data-active="false"'), 3)
})

test('Balken „hints“: keine Felder, Hinweis nur beim Dienst, der im Zeitraum nicht aktiv war; „beendet am“ bleibt', () => {
  const markup = bars('hints')
  assert.equal(count(markup, 'availability-report__opt '), 0)
  assert.equal(count(markup, 'Nicht im Zeitraum aktiv'), 1)
  assert.ok(markup.includes('beendet am 31.10.2026') && markup.includes('beendet am 31.08.2025'))
  assert.ok(!markup.includes('Aktiv im Berichtszeitraum'))
})

test('Balken ohne Zeilen: keine Kopfzeile', () => {
  assert.ok(!renderToStaticMarkup(<GroupBars rows={[]} locale="de-DE" timeZone="UTC" activeStyle="marks" />).includes('Aktiv heute'))
})
