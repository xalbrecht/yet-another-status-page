import ExcelJS from 'exceljs'
import { ta } from '@/lib/i18n/admin'
import type { ReportData } from '@/lib/report/aggregate'
import type { ReportParams } from '@/lib/report/params'
import type { ReportPeriod } from '@/lib/report/period'

/**
 * Excel-Datei des Berichts: ein Blatt mit den Diensten und ihren Monatswerten zum Filtern nach Gruppen, ein
 * Blatt mit jedem einzelnen Ausfall und ein Blatt mit den Angaben zur Auswahl und den Fußnoten.
 */
const MINUTE = 60_000
const HEADER_FILL = 'FFEEF1F5'

/** Prozentwert wie im Bericht auf zwei Stellen abgerundet, unbekannt als leere Zelle. */
const percent = (value: number | null): number | null => (value === null ? null : Math.floor(value * 100 + 1e-9) / 100)

/** Minuten mit einer Nachkommastelle: ein Ausfall von 20 Sekunden zeigt 0,3 statt 0, die Summe stimmt. */
const minutes = (ms: number) => Math.round((ms / MINUTE) * 10) / 10

/** `JJJJ-MM-TT HH:mm` in der Zeitzone der Einstellungen. */
function localStamp(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms)
}

function styleHeader(sheet: ExcelJS.Worksheet, columnCount: number): void {
  const header = sheet.getRow(1)
  header.font = { bold: true }
  header.alignment = { vertical: 'middle', wrapText: true }
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
  })
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnCount } }
}

function widths(sheet: ExcelJS.Worksheet, values: number[]): void {
  values.forEach((width, index) => {
    sheet.getColumn(index + 1).width = Math.min(40, Math.max(10, width))
  })
}

export async function buildWorkbook(input: { data: ReportData; params: ReportParams; period: ReportPeriod; timeZone: string }): Promise<Buffer> {
  const { data, params, period, timeZone } = input
  const workbook = new ExcelJS.Workbook()

  // Blatt 1: ein Dienst je Zeile
  const services = workbook.addWorksheet(ta('Services'))
  const monthColumns = data.heat.columns.map((column) => column.label)
  const serviceHeader = [
    ta('Service'),
    ta('Group'),
    ta('Target (%)'),
    ta('Availability in the period (%)'),
    ...monthColumns,
    ta('Outage duration (min)'),
    ta('Number of outages'),
    ta('Longest outage (min)'),
    ta('Degraded Performance (min)'),
    ta('Maintenance (min)'),
  ]
  services.addRow(serviceHeader)
  for (const row of data.ranking) {
    services.addRow([
      row.name,
      row.groupName,
      row.target,
      percent(row.availability),
      ...monthColumns.map((_, index) => percent(row.history[index] ?? null)),
      minutes(row.downMs),
      row.outageCount,
      minutes(row.longestOutageMs),
      minutes(row.degradedMs),
      minutes(row.maintenanceMs),
    ])
  }
  const percentColumns = [3, 4, ...monthColumns.map((_, index) => 5 + index)]
  for (const column of percentColumns) services.getColumn(column).numFmt = '0.00'
  const firstMinuteColumn = 5 + monthColumns.length
  for (const column of [firstMinuteColumn, firstMinuteColumn + 2, firstMinuteColumn + 3, firstMinuteColumn + 4]) services.getColumn(column).numFmt = '0.0'
  styleHeader(services, serviceHeader.length)
  widths(services, [30, 26, 12, 16, ...monthColumns.map(() => 12), 14, 12, 14, 16, 14])

  // Blatt 2: ein Ausfall je Zeile
  const outages = workbook.addWorksheet(ta('Outages'))
  const outageHeader = [ta('Service'), ta('Group'), ta('Start'), ta('End'), ta('Duration (min)'), ta('Type')]
  outages.addRow(outageHeader)
  for (const row of data.ranking) {
    for (const outage of row.outages) {
      outages.addRow([
        row.name,
        row.groupName,
        localStamp(outage.from, timeZone),
        localStamp(outage.to, timeZone),
        minutes(outage.to - outage.from),
        outage.status === 'major' ? ta('Major Outage') : ta('Partial Outage'),
      ])
    }
  }
  outages.getColumn(5).numFmt = '0.0'
  styleHeader(outages, outageHeader.length)
  widths(outages, [30, 26, 18, 18, 14, 18])

  // Blatt 3: Auswahl und Fußnoten
  const notes = workbook.addWorksheet(ta('Notes'))
  const maintenanceText = {
    A: ta('A: counts as available'),
    B: ta('B: counts as outage'),
    C: ta('C: excluded from the total time'),
  }[params.maintenance]
  const noteRows: Array<[string, string | number]> = [
    [ta('Period'), period.label],
    [ta('Calculation'), params.calc === 'monthly' ? ta('Mean of the monthly values') : ta('One value for the period')],
    [ta('Maintenance'), maintenanceText],
    [ta('Incidents not clearly classified, counted as Partial Outage'), data.footnotes.unsure],
    [ta('Incidents without a service, not considered'), data.footnotes.withoutService],
  ]
  if (params.maintenance === 'B') {
    noteRows.push([
      ta('Maintenance type B'),
      ta('The outage duration on the sheet Services includes the maintenance time. The sheet Outages lists only the outages, so its durations add up to less.'),
    ])
  }
  notes.addRow([ta('Item'), ta('Value')])
  for (const row of noteRows) notes.addRow(row)
  notes.getRow(1).font = { bold: true }
  widths(notes, [60, 40])

  return Buffer.from(await workbook.xlsx.writeBuffer())
}
