import { test } from 'node:test'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import { buildWorkbook } from '@/lib/report/export/excel'
import { overallBlocks } from '@/lib/report/export/blocks-overall'
import { groupBlocks } from '@/lib/report/export/blocks-group'
import { parseReportParams } from '@/lib/report/params'
import { HOUR, makeReportData, rankingRow } from './export-fixtures'

const period = { key: '2026-10', label: 'Oktober 2026', start: 0, end: 1, partial: false }
const ENDED_AT = Date.parse('2026-11-10T22:59:59.999Z') // Ende des 10.11.2026 in Berlin
const NOT_IN_PERIOD = Date.parse('2026-09-30T21:59:59.999Z')

const ranking = [
  rankingRow(1, 'Mailserver', 99.62, 2 * HOUR),
  rankingRow(2, 'Telefonanlage Nord', 98.4, 3 * HOUR, { activeToday: false, endedAt: ENDED_AT }),
  rankingRow(3, 'Altes Fachverfahren', null, 0, { activeInPeriod: false, activeToday: false, endedAt: NOT_IN_PERIOD }),
]

async function servicesSheet() {
  const buffer = await buildWorkbook({ data: makeReportData({ ranking }), params: parseReportParams({}), period, timeZone: 'Europe/Berlin' })
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
  return workbook.worksheets[0]
}

test('Excel, Blatt Dienste: Spalten „Aktiv im Berichtszeitraum“, „Aktiv heute“ und „Beendet am“', async () => {
  const sheet = await servicesSheet()
  const header = (sheet.getRow(1).values as unknown[]).slice(1)
  const column = (name: RegExp) => header.findIndex((value) => typeof value === 'string' && name.test(value)) + 1
  const inPeriod = column(/^(Aktiv im Berichtszeitraum|Active in the report period)$/)
  const today = column(/^(Aktiv heute|Active today)$/)
  const endedOn = column(/^(Beendet am|Ended on)$/)
  assert.ok(inPeriod > 0 && today > 0 && endedOn > 0, `Spalten fehlen: ${header.join(' | ')}`)
  const cell = (row: number, col: number) => sheet.getRow(row).getCell(col).value
  assert.deepEqual([cell(2, inPeriod), cell(2, today), cell(2, endedOn)], ['ja', 'ja', null])
  assert.deepEqual([cell(3, inPeriod), cell(3, today), cell(3, endedOn)], ['ja', 'nein', '2026-11-10'])
  assert.deepEqual([cell(4, inPeriod), cell(4, today), cell(4, endedOn)], ['nein', 'nein', '2026-09-30'])
})

const rankingSvg = () => overallBlocks(makeReportData({ ranking }), 'de-DE', 'Oktober 2026', 'Europe/Berlin').find((block) => block.file.startsWith('05-'))!.svg

test('Bild „Dienste“: zwei Marken je Dienst, gefüllt für ja, leer für nein, Füllung unterscheidbar', () => {
  const svg = rankingSvg()
  assert.equal((svg.match(/data-active="true"/g) ?? []).length, 3)
  assert.equal((svg.match(/data-active="false"/g) ?? []).length, 3)
  const yes = svg.match(/<circle[^>]*data-active="true"[^>]*>/)![0]
  const no = svg.match(/<circle[^>]*data-active="false"[^>]*>/)![0]
  assert.doesNotMatch(yes, /fill="none"/)
  assert.match(no, /fill="none"/)
})

test('Bild „Dienste“: beendete Dienste tragen „beendet am“ mit dem Tag in der Zeitzone der Installation und eine graue Zeile', () => {
  const svg = rankingSvg()
  assert.match(svg, /beendet am 10\.11\.2026/)
  assert.match(svg, /beendet am 30\.09\.2026/)
  assert.equal((svg.match(/data-ended="true"/g) ?? []).length, 2)
})

test('Gruppenbild „Dienste der Gruppe“: beendeter Dienst trägt den Text „beendet am“ und eine graue Zeile', () => {
  const data = makeReportData({ ranking, scope: { groupId: 1, groupName: 'Haushalt', serviceCount: 2 } })
  const svg = groupBlocks(data, 'de-DE', 'Oktober 2026', 'Europe/Berlin').find((block) => block.file.startsWith('02-'))!.svg
  assert.match(svg, /beendet am 10\.11\.2026/)
  assert.equal((svg.match(/data-ended="true"/g) ?? []).length, 2)
})
