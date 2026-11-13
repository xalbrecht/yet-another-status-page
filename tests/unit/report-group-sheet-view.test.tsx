import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { GroupSheet } from '@/components/admin/availability-report/GroupSheet'
import type { RankingRow, ReportData } from '@/lib/report/aggregate'
import type { GroupSheetData } from '@/lib/report/group-sheet'

const HOUR = 3_600_000
const months = Array.from({ length: 12 }, (_, index) => ({ key: `2026-${String(index + 1).padStart(2, '0')}`, label: `M${index + 1}` }))
const row = (id: number, name: string, availability: number | null, downMs: number): RankingRow => ({
  serviceId: id,
  name,
  groupName: 'Haushalt',
  availability,
  previousAvailability: 100,
  downMs,
  outageCount: downMs > 0 ? 1 : 0,
  longestOutageMs: downMs,
  maintenanceDownMs: 0,
  degradedMs: 0,
  maintenanceMs: 0,
  outages: [],
  target: 99,
  belowTarget: availability !== null && availability < 99,
  history: months.map(() => availability),
})

const days = (bars: Record<number, GroupSheetData['perDay'][number]['bars']>): GroupSheetData['perDay'] =>
  Array.from({ length: 31 }, (_, index) => ({ day: `2026-10-${String(index + 1).padStart(2, '0')}`, dayOfMonth: index + 1, bars: bars[index + 1] ?? [] }))

const sheetWithOutages: GroupSheetData = {
  month: { key: '2026-10', label: 'Oktober 2026' },
  perService: [{ serviceId: 1, name: 'MACH', majorMs: 1.5 * HOUR, partialMs: 2 * HOUR, degradedMs: 0 }],
  perDay: days({
    12: [{ serviceId: 1, name: 'MACH', status: 'partial', ms: 2 * HOUR }],
    13: [{ serviceId: 1, name: 'MACH', status: 'major', ms: 1.5 * HOUR }],
  }),
}

const dataWith = (override: Partial<ReportData> = {}): ReportData => ({
  scope: { groupId: 1, groupName: 'Haushalt', serviceCount: 2 },
  kpis: {
    availability: 99.41,
    previousAvailability: 99.5,
    downMs: 3.5 * HOUR,
    previousDownMs: 0,
    affectedServices: 1,
    serviceCount: 2,
    outageCount: 2,
    longestOutage: { ms: 2 * HOUR, serviceName: 'MACH' },
    degradedMs: 0,
    maintenanceMs: 0,
    monthsMet: 1,
    monthsTotal: 1,
    target: 99,
  },
  weakest: [],
  trend: months.map((month, index) => ({ ...month, availability: 99.2 + index * 0.05 })),
  heat: {
    columns: months,
    rows: [
      { name: 'Gesamt', values: months.map(() => 99.4), total: true },
      { name: 'MACH', values: months.map(() => 98.1) },
      { name: 'Kasse', values: months.map(() => 100) },
    ],
  },
  ranking: [row(1, 'MACH', 98.1, 3.5 * HOUR), row(2, 'Kasse', 100, 0)],
  groupList: [],
  sheet: sheetWithOutages,
  footnotes: { unsure: 0, withoutService: 0 },
  ...override,
})

const render = (data: ReportData) => renderToStaticMarkup(<GroupSheet data={data} locale="de-DE" />)
const dayBlock = (markup: string) => markup.slice(markup.indexOf('data-testid="sheet-by-day"'))

test('das Blatt zeigt Titel, Entwicklung, Dienste, Störungen je Dienst und je Tag und die Wärmekarte', () => {
  const markup = render(dataWith())
  assert.match(markup, /Gruppenblatt|Group sheet/)
  assert.match(markup, /Haushalt/)
  for (const id of ['report-trend', 'sheet-services', 'sheet-by-service', 'sheet-by-day', 'report-heat']) {
    assert.match(markup, new RegExp(`data-testid="${id}"`), id)
  }
})

test('Block 4 zeichnet je Balken ein Rechteck der Art des Ausfalls und die Dienstnamen senkrecht', () => {
  const block = dayBlock(render(dataWith()))
  assert.equal((block.match(/<rect[^>]*availability-report__sev-major/g) ?? []).length, 1)
  assert.equal((block.match(/<rect[^>]*availability-report__sev-partial/g) ?? []).length, 1)
  assert.match(block, /rotate\(90[^>]*>MACH</)
})

test('die Überschriften der Blöcke 3 und 4 nennen den Monat', () => {
  const markup = render(dataWith())
  const byService = markup.slice(markup.indexOf('data-testid="sheet-by-service"'), markup.indexOf('data-testid="sheet-by-day"'))
  assert.match(byService, /Oktober 2026/)
  assert.match(dayBlock(markup), /Oktober 2026/)
})

test('ohne Störungen im Monat fehlen Block 3 und 4', () => {
  const markup = render(dataWith({ sheet: { ...sheetWithOutages, perService: [], perDay: days({}) } }))
  assert.doesNotMatch(markup, /data-testid="sheet-by-service"/)
  assert.doesNotMatch(markup, /data-testid="sheet-by-day"/)
})

test('mit nur einer Einschränkung steht Block 3, aber nicht Block 4', () => {
  const sheet: GroupSheetData = {
    ...sheetWithOutages,
    perService: [{ serviceId: 1, name: 'Langsam', majorMs: 0, partialMs: 0, degradedMs: 2 * HOUR }],
    perDay: days({}),
  }
  const markup = render(dataWith({ sheet }))
  assert.match(markup, /data-testid="sheet-by-service"/)
  assert.doesNotMatch(markup, /data-testid="sheet-by-day"/)
})

test('eine Gruppe mit einem Dienst ergibt ein volles Blatt mit einer Zeile in Block 2', () => {
  const markup = render(dataWith({ scope: { groupId: 1, groupName: 'Umwelt', serviceCount: 1 }, ranking: [row(1, 'Umweltportal', 100, 0)], sheet: { ...sheetWithOutages, perService: [], perDay: days({}) } }))
  const services = markup.slice(markup.indexOf('data-testid="sheet-services"'))
  assert.equal((services.slice(0, services.indexOf('</section>')).match(/availability-report__bar-row/g) ?? []).length, 1)
})

test('ohne bekannte Verfügbarkeit bricht das Blatt nicht ab und zeigt einen Strich', () => {
  const data = dataWith()
  const markup = render({ ...data, kpis: { ...data.kpis, availability: null }, ranking: [row(1, 'Neu', null, 0)] })
  assert.match(markup, /–/)
  assert.match(markup, /data-testid="sheet-services"/)
})

test('ohne sheet (keine Monate) fehlen Block 3 und 4, der Rest erscheint', () => {
  const markup = render(dataWith({ sheet: null }))
  assert.doesNotMatch(markup, /data-testid="sheet-by-service"/)
  assert.match(markup, /data-testid="report-heat"/)
})

const bar = (id: number, name: string, status: 'partial' | 'major', ms: number) => ({ serviceId: id, name, status, ms })

test('Block 4: an einem Tag mit zwei Balken stehen beide Dienstnamen', () => {
  const sheet: GroupSheetData = { ...sheetWithOutages, perDay: days({ 20: [bar(1, 'Eins', 'major', HOUR), bar(2, 'Zwei', 'partial', HOUR)] }) }
  const block = dayBlock(render(dataWith({ sheet })))
  assert.match(block, />Eins</)
  assert.match(block, />Zwei</)
})

test('Block 4: ab drei Balken an einem Tag steht die Zahl der Dienste statt der überlappenden Namen', () => {
  const sheet: GroupSheetData = {
    ...sheetWithOutages,
    perDay: days({ 20: [bar(1, 'Alpha', 'major', 3 * HOUR), bar(2, 'Beta', 'major', 2 * HOUR), bar(3, 'Gamma', 'partial', HOUR)] }),
  }
  const block = dayBlock(render(dataWith({ sheet })))
  assert.equal((block.match(/<rect/g) ?? []).length, 3, 'die Balken bleiben')
  assert.doesNotMatch(block, />Alpha</)
  assert.match(block, />3 Dienste<|>3 services</)
  assert.match(block, /<title>Alpha, 20\./, 'der Name steht im Tooltip')
})

test('Block 2 nennt bei Wartungsart B den Wartungsanteil getrennt von der Störungsdauer', () => {
  const withMaintenance: RankingRow = { ...row(1, 'MACH', 97, 5 * HOUR), maintenanceDownMs: 3 * HOUR, outageCount: 1 }
  const markup = render(dataWith({ ranking: [withMaintenance] }))
  const services = markup.slice(markup.indexOf('data-testid="sheet-services"'))
  assert.match(services, /2 Std\.|2 h/)
  assert.match(services, /3 Std\. Wartung|3 h maintenance/)
  assert.match(services, /zählt als Ausfall|counts as outage/)
})

test('Block 2 zeigt ohne Wartungsanteil nur die Dauer', () => {
  const services = render(dataWith()).slice(render(dataWith()).indexOf('data-testid="sheet-services"'))
  assert.doesNotMatch(services.slice(0, services.indexOf('</section>')), /Wartung|maintenance/)
})
