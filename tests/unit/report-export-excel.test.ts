import { test } from 'node:test'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import { buildWorkbook } from '@/lib/report/export/excel'
import { parseReportParams } from '@/lib/report/params'
import { HOUR, makeReportData, months, rankingRow } from './export-fixtures'

const period = { key: '2026-10', label: 'Oktober 2026', start: 0, end: 1, partial: false }
const params = parseReportParams({})

async function load(data = makeReportData()) {
  const buffer = await buildWorkbook({ data, params, period, timeZone: 'Europe/Berlin' })
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
  return workbook
}

const ranking = [
  rankingRow(1, 'Haus & Hof', 98.12, 2 * HOUR, { degradedMs: 30 * 60_000, maintenanceMs: 10 * 60_000, longestOutageMs: 2 * HOUR }),
  rankingRow(2, 'Neu', null, 0),
]

test('die Datei hat drei Blätter in der vorgesehenen Reihenfolge', async () => {
  const workbook = await load(makeReportData({ ranking }))
  assert.equal(workbook.worksheets.length, 3)
  assert.match(workbook.worksheets[0].name, /^(Dienste|Services)$/)
  assert.match(workbook.worksheets[1].name, /^(Ausfälle|Outages)$/)
  assert.match(workbook.worksheets[2].name, /^(Hinweise|Notes)$/)
})

test('Blatt Dienste: eine Zeile je Dienst, Prozentwerte als Zahl, unbekannt als leere Zelle', async () => {
  const sheet = (await load(makeReportData({ ranking }))).worksheets[0]
  assert.equal(sheet.rowCount, 3)
  const header = sheet.getRow(1).values as unknown[]
  assert.ok(header.includes('Monat 1') && header.includes('Monat 12'))
  const first = sheet.getRow(2)
  assert.equal(first.getCell(1).value, 'Haus & Hof')
  assert.equal(first.getCell(2).value, 'Haushalt')
  assert.equal(first.getCell(3).value, 99)
  assert.equal(first.getCell(4).value, 98.12)
  assert.equal(first.getCell(5).value, 98.12)
  const second = sheet.getRow(3)
  assert.equal(second.getCell(4).value, null)
  assert.equal(second.getCell(5).value, null)
})

test('Blatt Dienste: Dauern in Minuten, Anzahl der Ausfälle und längster Ausfall', async () => {
  const row = (await load(makeReportData({ ranking }))).worksheets[0].getRow(2)
  const base = 4 + 12
  assert.equal(row.getCell(base + 1).value, 120)
  assert.equal(row.getCell(base + 2).value, 1)
  assert.equal(row.getCell(base + 3).value, 120)
  assert.equal(row.getCell(base + 4).value, 30)
  assert.equal(row.getCell(base + 5).value, 10)
})

test('Blätter Dienste und Ausfälle haben Filter und fixierte Kopfzeile', async () => {
  const workbook = await load(makeReportData({ ranking }))
  for (const sheet of workbook.worksheets.slice(0, 2)) {
    assert.ok(sheet.autoFilter, sheet.name)
    assert.equal(sheet.views[0].state, 'frozen', sheet.name)
    assert.equal(sheet.views[0].ySplit, 1, sheet.name)
  }
})

test('Blatt Ausfälle: Beginn und Ende in der Zeitzone, Dauer in Minuten, Art', async () => {
  const sheet = (await load(makeReportData({ ranking }))).worksheets[1]
  assert.equal(sheet.rowCount, 2)
  const row = sheet.getRow(2)
  assert.equal(row.getCell(1).value, 'Haus & Hof')
  assert.equal(row.getCell(3).value, '2026-10-12 10:00')
  assert.equal(row.getCell(4).value, '2026-10-12 12:00')
  assert.equal(row.getCell(5).value, 120)
  assert.match(String(row.getCell(6).value), /Teilausfall|Partial Outage/)
})

test('Blatt Hinweise nennt Zeitraum, Rechenart, Wartungsart und die Fußnoten', async () => {
  const sheet = (await load(makeReportData({ ranking }))).worksheets[2]
  const text = sheet.getSheetValues().flat().map(String).join('|')
  assert.match(text, /Oktober 2026/)
  assert.match(text, /(^|\|)78(\||$)/)
  assert.match(text, /(^|\|)19(\||$)/)
  assert.match(text, /A/)
})

test('ein Bericht ohne Dienste ergibt Blätter nur mit Kopfzeile', async () => {
  const workbook = await load(makeReportData({ ranking: [], heat: { columns: months, rows: [] } }))
  assert.equal(workbook.worksheets[0].rowCount, 1)
  assert.equal(workbook.worksheets[1].rowCount, 1)
})
