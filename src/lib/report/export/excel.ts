import ExcelJS from 'exceljs'
import { ta } from '@/lib/i18n/admin'
import type { ReportData } from '@/lib/report/aggregate'
import type { ReportParams } from '@/lib/report/params'
import type { ReportPeriod } from '@/lib/report/period'

/**
 * Excel-Datei des Berichts (Konzept 5): ein Blatt mit den Diensten und ihren Monatswerten zum Filtern nach Gruppen, ein
 * Blatt mit jedem einzelnen Ausfall und ein Blatt mit den Angaben zur Auswahl und den Fußnoten.
 */
const MINUTE = 60_000
const HEADER_FILL = 'FFEEF1F5'

/** Prozentwert wie im Bericht auf zwei Stellen abgerundet, unbekannt als leere Zelle. */
const percent = (value: number | null): number | null => (value === null ? null : Math.floor(value * 100 + 1e-9) / 100)

const minutes = (ms: number) => Math.round(ms / MINUTE)

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
  const services = workbook.addWorksheet(ta('Services', 'Dienste'))
  const monthColumns = data.heat.columns.map((column) => column.label)
  const serviceHeader = [
    ta('Service', 'Dienst'),
    ta('Group', 'Gruppe'),
    ta('Target (%)', 'Zielwert (%)'),
    ta('Availability in the period (%)', 'Verfügbarkeit im Zeitraum (%)'),
    ...monthColumns,
    ta('Outage duration (min)', 'Ausfalldauer (Min.)'),
    ta('Number of outages', 'Anzahl Ausfälle'),
    ta('Longest outage (min)', 'Längster Ausfall (Min.)'),
    ta('Degraded Performance (min)', 'Dauer Eingeschränkt (Min.)'),
    ta('Maintenance (min)', 'Dauer Wartung (Min.)'),
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
  styleHeader(services, serviceHeader.length)
  widths(services, [30, 26, 12, 16, ...monthColumns.map(() => 12), 14, 12, 14, 16, 14])

  // Blatt 2: ein Ausfall je Zeile
  const outages = workbook.addWorksheet(ta('Outages', 'Ausfälle'))
  const outageHeader = [ta('Service', 'Dienst'), ta('Group', 'Gruppe'), ta('Start', 'Beginn'), ta('End', 'Ende'), ta('Duration (min)', 'Dauer (Min.)'), ta('Type', 'Art')]
  outages.addRow(outageHeader)
  for (const row of data.ranking) {
    for (const outage of row.outages) {
      outages.addRow([
        row.name,
        row.groupName,
        localStamp(outage.from, timeZone),
        localStamp(outage.to, timeZone),
        minutes(outage.to - outage.from),
        outage.status === 'major' ? ta('Major Outage', 'Schwerer Ausfall') : ta('Partial Outage', 'Teilausfall'),
      ])
    }
  }
  styleHeader(outages, outageHeader.length)
  widths(outages, [30, 26, 18, 18, 14, 18])

  // Blatt 3: Auswahl und Fußnoten
  const notes = workbook.addWorksheet(ta('Notes', 'Hinweise'))
  const maintenanceText = {
    A: ta('A: counts as available', 'A: zählt als verfügbar'),
    B: ta('B: counts as outage', 'B: zählt als Ausfall'),
    C: ta('C: excluded from the total time', 'C: aus der Gesamtzeit herausgenommen'),
  }[params.maintenance]
  const noteRows: Array<[string, string | number]> = [
    [ta('Period', 'Zeitraum'), period.label],
    [ta('Calculation', 'Rechenart'), params.calc === 'monthly' ? ta('Mean of the monthly values', 'Mittel der Monatswerte') : ta('One value for the period', 'Ein Wert für den Zeitraum')],
    [ta('Maintenance', 'Wartung'), maintenanceText],
    [ta('Incidents not clearly classified, counted as Partial Outage', 'Nicht eindeutig eingeordnete Vorfälle, als Teilausfall gewertet'), data.footnotes.unsure],
    [ta('Incidents without a service, not considered', 'Vorfälle ohne Dienst, nicht berücksichtigt'), data.footnotes.withoutService],
  ]
  notes.addRow([ta('Item', 'Angabe'), ta('Value', 'Wert')])
  for (const row of noteRows) notes.addRow(row)
  notes.getRow(1).font = { bold: true }
  widths(notes, [60, 40])

  return Buffer.from(await workbook.xlsx.writeBuffer())
}
