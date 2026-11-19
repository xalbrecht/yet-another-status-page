import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { ReactElement } from 'react'
import { renderToStaticMarkup as renderPlain } from 'react-dom/server'
import { withAdminText } from './i18n-helpers'

// Admin-Komponenten lesen ihre Texte aus dem Kontext (AdminTextProvider im Layout von Payload).
const renderToStaticMarkup = (node: ReactElement) => renderPlain(withAdminText(node))
import { ReportView } from '@/components/admin/availability-report/ReportView'
import { ReportControlsForm, shouldSubmitOnChange } from '@/components/admin/availability-report/ReportControlsForm'
import { GroupList } from '@/components/admin/availability-report/GroupList'
import { ViewTabs } from '@/components/admin/availability-report/ViewTabs'
import type { GroupListEntry, ReportData, RankingRow } from '@/lib/report/aggregate'
import { parseReportParams } from '@/lib/report/params'

const MIN = 60_000
const months = Array.from({ length: 12 }, (_, index) => ({ key: `2026-${String(index + 1).padStart(2, '0')}`, label: `M${index + 1}` }))
const row = (name: string, availability: number | null, belowTarget: boolean): RankingRow => ({
  serviceId: name.length,
  name,
  groupName: 'Haushalt',
  availability,
  previousAvailability: 100,
  downMs: belowTarget ? 2793 * MIN : 0,
  outageCount: belowTarget ? 1 : 0,
  longestOutageMs: belowTarget ? 2793 * MIN : 0,
  maintenanceDownMs: 0,
  degradedMs: 0,
  maintenanceMs: 0,
  maintenanceByKind: { sla: 0, additional: 0 },
  outages: [],
  target: 99,
  belowTarget,
  history: Array.from({ length: 12 }, () => availability),
  activeInPeriod: true,
  activeToday: true,
  endedAt: null,
})
const data: ReportData = {
  scope: { groupId: null, groupName: null, serviceCount: 200 },
  kpis: {
    availability: 99.7123,
    previousAvailability: 99.5,
    downMs: 357 * 60 * MIN,
    previousDownMs: 80 * 60 * MIN,
    affectedServices: 20,
    serviceCount: 200,
    outageCount: 24,
    longestOutage: { ms: 2793 * MIN, serviceName: 'Infoma' },
    degradedMs: 180 * MIN,
    maintenanceMs: 600 * MIN,
    maintenanceByKind: { sla: 600 * MIN, additional: 0 },
    monthsMet: 1,
    monthsTotal: 1,
    target: 99,
  },
  weakest: [row('Infoma', 93.74, true)],
  trend: months.map((month, index) => ({ ...month, availability: 99.2 + index * 0.05 })),
  heat: {
    columns: months,
    rows: [
      { name: 'Gesamt', values: months.map(() => 99.7), total: true },
      { name: 'Haushalt und Finanzen', values: months.map((_, index) => (index === 11 ? 93.7 : 100)) },
    ],
  },
  ranking: [row('Infoma', 93.74, true), row('VPN', 99.9, false)],
  groupList: [],
  sheet: null,
  footnotes: { unsure: 78, withoutService: 19 },
}
const params = parseReportParams({ maintenance: 'B', calc: 'monthly', topN: '7' })
const period = { key: '2026-10', label: 'Oktober 2026', start: 0, end: 1, partial: false }
const render = (override: Partial<Parameters<typeof ReportView>[0]> = {}) =>
  renderToStaticMarkup(<ReportView data={data} params={params} period={period} locale="de-DE" timeZone="Europe/Berlin" controls={<div data-testid="controls" />} {...override} />)

test('zeigt Überschrift mit Zeitraum, Verfügbarkeit mit Komma und Zielstatus', () => {
  const markup = render()
  assert.match(markup, /Oktober 2026/)
  assert.match(markup, /99,71 %/)
  assert.match(markup, /data-testid="controls"/)
})

test('der Vermerk „unter Ziel“ steht nur bei dem Dienst unter dem Zielwert', () => {
  const markup = render()
  assert.equal((markup.match(/unter Ziel|below target/g) ?? []).length >= 1, true)
  const ranking = markup.slice(markup.indexOf('data-testid="report-ranking"'))
  assert.equal((ranking.match(/report-below-target/g) ?? []).length, 1)
})

test('Fußnoten nennen die Zahlen', () => {
  const markup = render()
  assert.match(markup, /78/)
  assert.match(markup, /19/)
})

test('Wartungszeile nur bei eingeschalteter Anzeige', () => {
  assert.match(render(), /data-testid="report-maintenance"/)
  const hidden = render({ params: parseReportParams({ showMaintenance: 'false' }) })
  assert.doesNotMatch(hidden, /data-testid="report-maintenance"/)
})

test('Wärmekarte mit Gesamtzeile und ohne Rot-Grün-Paar in den Farbangaben', () => {
  const markup = render()
  assert.match(markup, /data-testid="report-heat"/)
  assert.match(markup, /Gesamt/)
  assert.doesNotMatch(markup, /green/i)
  assert.doesNotMatch(markup, /style="[^"]*(?:red|#f00)/i)
})

test('Verlauf mit Zielwertlinie', () => {
  const markup = render()
  assert.match(markup, /data-testid="report-trend"/)
  assert.match(markup, /Ziel 99,00 %|target 99,00 %/i)
})

test('bei einem Fehler steht der Text statt der Tabellen', () => {
  const markup = render({ data: { ...data, error: 'Die gewählte Gruppe wurde nicht gefunden.' } })
  assert.match(markup, /Die gewählte Gruppe wurde nicht gefunden/)
  assert.doesNotMatch(markup, /data-testid="report-ranking"/)
})

test('die Auswahlfelder zeigen die gesetzten Werte', () => {
  const markup = renderToStaticMarkup(
    <ReportControlsForm
      params={params}
      periodKey="2026-10"
      periodOptions={[{ value: '2026-10', label: 'Oktober 2026' }, { value: 'custom', label: 'Freier Zeitraum' }]}
    />,
  )
  assert.match(markup, /<option value="B" selected/)
  assert.match(markup, /<option value="monthly" selected/)
  assert.match(markup, /<option value="7" selected/)
  assert.match(markup, /<option value="2026-10" selected/)
  assert.match(markup, /name="showMaintenance"[^>]*checked/)
})

test('ein Wert knapp unter 100 Prozent erscheint nicht als 100 in der Wärmekarte', () => {
  const heat = { ...data.heat, rows: [{ name: 'Gesamt', values: months.map(() => 99.99596), total: true }] }
  const markup = render({ data: { ...data, heat } })
  const cells = markup.slice(markup.indexOf('data-testid="report-heat"'))
  assert.match(cells, />99,9</)
  assert.doesNotMatch(cells, />100</)
})

test('der Zielstatus nennt den Abstand in Punkten', () => {
  const missed = render({ data: { ...data, kpis: { ...data.kpis, availability: 98.5 } } })
  assert.match(missed, /verfehlt um 0,50 Punkte|missed by 0\.50 points/)
})

test('Wartung als Ausfall (Art B) ohne Störung steht in der Ausfalldauer, nicht als „kein Ausfall“', () => {
  const maintenanceOnly: RankingRow = { ...row('Nur Wartung', 98.65, true), downMs: 600 * MIN, outageCount: 0, longestOutageMs: 0, maintenanceDownMs: 600 * MIN }
  const markup = render({ data: { ...data, ranking: [maintenanceOnly], weakest: [maintenanceOnly] } })
  const ranking = markup.slice(markup.indexOf('data-testid="report-ranking"'))
  assert.doesNotMatch(ranking, /kein Ausfall|no outage/)
  assert.match(ranking, /Wartung|maintenance/i)
})

test('Datumsfelder und die Wahl „Freier Zeitraum“ senden nicht sofort ab, Auswahlfelder schon', () => {
  assert.equal(shouldSubmitOnChange({ type: 'date', name: 'from', value: '2026-1' }), false)
  assert.equal(shouldSubmitOnChange({ type: 'select-one', name: 'period', value: 'custom' }), false)
  assert.equal(shouldSubmitOnChange({ type: 'select-one', name: 'period', value: '2026-10' }), true)
  assert.equal(shouldSubmitOnChange({ type: 'select-one', name: 'maintenance', value: 'B' }), true)
  assert.equal(shouldSubmitOnChange({ type: 'checkbox', name: 'showMaintenance', value: 'true' }), true)
})

test('die Datumsfelder und die Schaltfläche „Anwenden“ stehen immer da', () => {
  const markup = renderToStaticMarkup(
    <ReportControlsForm params={params} periodKey="2026-10" periodOptions={[{ value: '2026-10', label: 'Oktober 2026' }]} />,
  )
  assert.match(markup, /name="from"/)
  assert.match(markup, /name="to"/)
  assert.match(markup, /<button type="submit"/)
})

const formWith = (search: Record<string, string>) =>
  renderToStaticMarkup(
    <ReportControlsForm params={parseReportParams(search)} periodKey="2026-10" periodOptions={[{ value: '2026-10', label: 'Oktober 2026' }]} />,
  )

test('im Gruppentab trägt das Formular Ansicht und Gruppe weiter, ein Auswahlfeld „Gruppe“ gibt es nicht', () => {
  const markup = formWith({ view: 'groups', group: '7' })
  assert.match(markup, /name="view" value="groups"/)
  assert.match(markup, /name="group" value="7"/)
  assert.doesNotMatch(markup, /<select name="group"/)
})

test('im Gesamtbericht trägt das Formular die gewählte Gruppe weiter, ohne Gruppe keine', () => {
  const markup = formWith({ group: '7' })
  assert.match(markup, /name="view" value="overall"/)
  assert.match(markup, /name="group" value="7"/)
  assert.doesNotMatch(formWith({}), /name="group"/)
})

test('in den Gruppenberichten fehlen „Schwächste Dienste“ und „Wartungszeit“, ihre Werte bleiben als versteckte Felder', () => {
  const markup = formWith({ view: 'groups', group: '7', topN: '7', showMaintenance: 'false' })
  assert.doesNotMatch(markup, /<select[^>]*name="topN"/)
  assert.doesNotMatch(markup, /type="checkbox"[^>]*name="showMaintenance"|name="showMaintenance"[^>]*type="checkbox"/)
  assert.match(markup, /name="topN" value="7"/)
  assert.match(markup, /name="showMaintenance" value="false"/)
  const overall = formWith({ topN: '7' })
  assert.match(overall, /<select[^>]*name="topN"/)
})

test('die Tabs markieren nur die aktive Ansicht', () => {
  const markup = renderToStaticMarkup(<ViewTabs active="groups" hrefs={{ overall: '/a', groups: '/b' }} />)
  assert.equal((markup.match(/aria-current="page"/g) ?? []).length, 1)
  assert.match(markup, /<a[^>]*href="\/b"[^>]*aria-current="page"/)
  assert.match(markup, /Gesamtbericht/)
  assert.match(markup, /Gruppenberichte/)
})

const entry = (id: number, name: string, availability: number | null, level: GroupListEntry['level']): GroupListEntry => ({ id, name, serviceCount: 1, availability, target: 99, level })

test('die Gruppenliste behält die Reihenfolge, markiert die gewählte Gruppe und zeigt „–“ ohne Wert', () => {
  const markup = renderToStaticMarkup(
    <GroupList groups={[entry(1, 'Eins', 98.1, 4), entry(2, 'Zwei', 99.9, 1), entry(3, 'Drei', null, 0)]} selectedId={2} hrefFor={(id) => `/g/${id}`} locale="de-DE" />,
  )
  assert.match(markup, /data-testid="group-list"/)
  assert.ok(markup.indexOf('Eins') < markup.indexOf('Zwei') && markup.indexOf('Zwei') < markup.indexOf('Drei'))
  assert.equal((markup.match(/aria-current="true"/g) ?? []).length, 1)
  assert.match(markup, /<a[^>]*(?:href="\/g\/2"[^>]*aria-current="true"|aria-current="true"[^>]*href="\/g\/2")/)
  assert.match(markup, /98,10 %/)
  assert.match(markup, /Drei[\s\S]*–/)
  assert.match(markup, /heat-4/)
})

test('die Gruppenansicht des Gesamtberichts ist entfernt: Wärmekarte nach Dienstgruppen, Spalte „Gruppe“ bleibt', () => {
  const markup = render({ data: { ...data, scope: { groupId: 1, groupName: 'Haushalt', serviceCount: 2 } } })
  assert.match(markup, /Wärmekarte nach Dienstgruppen|Heat map by service group/)
  assert.doesNotMatch(markup, /Dienste der Gruppe|Services of the group/)
  assert.match(markup, /<th>(Gruppe|Group)<\/th>/)
})

test('die Tabs stehen unter den Auswahlfeldern, übergebene Inhalte ersetzen den Gesamtbericht', () => {
  const markup = render({ tabs: <nav data-testid="tabs" />, children: <div data-testid="eigener-inhalt" /> })
  assert.ok(markup.indexOf('data-testid="controls"') < markup.indexOf('data-testid="tabs"'))
  assert.match(markup, /data-testid="eigener-inhalt"/)
  assert.doesNotMatch(markup, /data-testid="report-ranking"/)
  assert.match(render({ tabs: <nav data-testid="tabs" /> }), /data-testid="report-ranking"/)
})

const endOfDayBerlin = Date.parse('2026-11-10T22:59:59.999Z') // Ende des 10.11.2026 in Berlin
const withRanking = (ranking: RankingRow[]): ReportData => ({ ...data, ranking })
const rankingSection = (markup: string) => markup.slice(markup.indexOf('data-testid="report-ranking"'))

test('Rangliste: zwei Spalten „Aktiv im Berichtszeitraum“ und „Aktiv heute“ mit je einem Optionsfeld je Dienst', () => {
  const markup = render({ data: withRanking([row('Infoma', 93.74, true), { ...row('Telefon', 98.4, false), activeToday: false, endedAt: endOfDayBerlin }]) })
  const section = rankingSection(markup)
  assert.match(section, /Aktiv im Berichtszeitraum/)
  assert.match(section, /Aktiv heute/)
  assert.equal((section.match(/data-active="true"/g) ?? []).length, 3) // Infoma 2x, Telefon im Zeitraum
  assert.equal((section.match(/data-active="false"/g) ?? []).length, 1) // Telefon heute
})

test('Rangliste: beendeter Dienst trägt den Text „beendet am“ mit dem Tag in der Zeitzone der Installation und eine graue Zeile', () => {
  const markup = render({ data: withRanking([row('Infoma', 93.74, true), { ...row('Telefon', 98.4, false), activeToday: false, endedAt: endOfDayBerlin }]) })
  const section = rankingSection(markup)
  assert.match(section, /beendet am 10\.11\.2026/)
  assert.equal((section.match(/availability-report__row--ended/g) ?? []).length, 1)
})

test('Rangliste: Dienst ohne Berührung des Zeitraums nennt das statt einer Ausfalldauer, beide Felder leer', () => {
  const none = { ...row('Altes Verfahren', null, false), activeInPeriod: false, activeToday: false, endedAt: Date.parse('2026-09-30T21:59:59.999Z') }
  const section = rankingSection(render({ data: withRanking([none]) }))
  assert.match(section, /beendet am 30\.09\.2026/)
  assert.match(section, /Nicht im Zeitraum aktiv/)
  assert.equal((section.match(/data-active="false"/g) ?? []).length, 2)
})

test('ohne beendete Dienste fehlt der Text „beendet am“ in der Seite', () => {
  assert.doesNotMatch(render(), /beendet am/)
})

test('Bedienleiste: Kontrollkästchen „Beendete Dienste einbeziehen“ ist ohne Parameter aus und mit ended=true an', () => {
  const off = renderToStaticMarkup(<ReportControlsForm params={parseReportParams({})} periodKey="2026-10" periodOptions={[{ value: '2026-10', label: 'Oktober 2026' }]} />)
  assert.match(off, /Beendete Dienste einbeziehen/)
  assert.match(off, /name="ended"/)
  assert.doesNotMatch(off.slice(off.indexOf('name="ended"') - 80, off.indexOf('name="ended"') + 120), /checked/)
  const on = renderToStaticMarkup(<ReportControlsForm params={parseReportParams({ ended: 'true' })} periodKey="2026-10" periodOptions={[{ value: '2026-10', label: 'Oktober 2026' }]} />)
  assert.match(on.slice(on.indexOf('name="ended"') - 80, on.indexOf('name="ended"') + 160), /checked/)
})
