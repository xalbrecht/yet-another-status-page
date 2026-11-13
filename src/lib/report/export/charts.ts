import { ta } from '@/lib/i18n/admin'
import { formatAvailability } from '@/lib/availability'
import type { ReportData } from '@/lib/report/aggregate'
import { heatCellText, heatClass } from '@/lib/report/heat'
import { GRID_COLOR, HEAT_COLOR, LINE_COLOR, MUTED_COLOR, TARGET_COLOR, TEXT_COLOR } from './palette'
import { textEl, truncate } from './svg'

/** Gemeinsame Zeichnungen der exportierten Bilder (Entwicklungslinie, Wärmekarte). Jede Funktion liefert SVG-Inhalt ab (0, 0). */

/** Verlauf der letzten 12 Monate als Linie mit gestrichelter Zielwertlinie, nach dem Vorbild von `TrendChart.tsx`. */
export function trendChart(trend: ReportData['trend'], target: number, locale: string, width: number, height: number): string {
  const L = 56
  const R = 16
  const T = 14
  const B = 30
  const known = trend.map((point) => point.availability).filter((value): value is number => value !== null)
  const min = Math.floor((Math.min(...known, target) - 0.5) * 2) / 2
  const max = 100
  const x = (index: number) => L + (index * (width - L - R)) / Math.max(1, trend.length - 1)
  const y = (value: number) => T + ((max - value) / (max - min)) * (height - T - B)
  const step = max - min > 1.6 ? 0.5 : 0.25
  const nf = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  let body = ''
  for (let value = max; value >= min - 1e-9; value -= step) {
    body += `<line x1="${L}" x2="${width - R}" y1="${y(value)}" y2="${y(value)}" stroke="${GRID_COLOR}"/>`
    body += textEl(L - 8, y(value) + 4, nf.format(value), { size: 11, anchor: 'end', fill: MUTED_COLOR })
  }
  body += `<line x1="${L}" x2="${width - R}" y1="${y(target)}" y2="${y(target)}" stroke="${TARGET_COLOR}" stroke-width="1.5" stroke-dasharray="6 4"/>`
  body += textEl(width - R, y(target) - 6, `${ta('Target', 'Ziel')} ${formatAvailability(target, locale)}`, { size: 11, anchor: 'end', fill: TARGET_COLOR })
  const points = trend.flatMap((point, index) => (point.availability === null ? [] : [`${x(index)},${y(point.availability)}`])).join(' ')
  if (points) body += `<polyline points="${points}" fill="none" stroke="${LINE_COLOR}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`
  trend.forEach((point, index) => {
    if (point.availability !== null) body += `<circle cx="${x(index)}" cy="${y(point.availability)}" r="${index === trend.length - 1 ? 5.5 : 3.5}" fill="${LINE_COLOR}"/>`
    body += textEl(x(index), height - 8, point.label.slice(0, 3), { size: 11, anchor: 'middle', fill: MUTED_COLOR })
  })
  return body
}

export const HEAT_ROW_HEIGHT = 26
const HEAT_HEAD_HEIGHT = 24

/** Höhe einer Wärmekarte mit `rowCount` Zeilen (ohne Legende). */
export const heatTableHeight = (rowCount: number) => HEAT_HEAD_HEIGHT + rowCount * HEAT_ROW_HEIGHT

/** Wärmekarte: Kopfzeile mit Monaten, je Zeile ein Name und zwölf Zellen. Namen höchstens 30 Zeichen. */
export function heatTable(heat: ReportData['heat'], rows: ReportData['heat']['rows'], target: number, locale: string, width: number): string {
  const labelWidth = 250
  const cell = (width - labelWidth) / heat.columns.length
  let body = ''
  heat.columns.forEach((column, index) => {
    body += textEl(labelWidth + index * cell + cell / 2, 16, column.label.slice(0, 3), { size: 11, anchor: 'middle', fill: MUTED_COLOR })
  })
  rows.forEach((row, rowIndex) => {
    const top = HEAT_HEAD_HEIGHT + rowIndex * HEAT_ROW_HEIGHT
    const name = row.total ? ta('Total', 'Gesamt') : row.name
    body += textEl(labelWidth - 10, top + 17, truncate(name, 30), { size: 12, anchor: 'end', weight: row.total ? 'bold' : 'normal' })
    row.values.forEach((value, index) => {
      body += `<rect x="${labelWidth + index * cell + 1}" y="${top + 1}" width="${cell - 2}" height="${HEAT_ROW_HEIGHT - 2}" rx="3" fill="${HEAT_COLOR[heatClass(value, target)]}"/>`
      body += textEl(labelWidth + index * cell + cell / 2, top + 17, heatCellText(value, locale), { size: 11, anchor: 'middle', fill: TEXT_COLOR })
    })
  })
  return body
}

/** Legende der Farbstufen in einer Zeile ab (x, y). */
export function heatLegend(target: number, locale: string, x: number, y: number): string {
  const entries: Array<[string, number]> = [
    ['100 %', 0],
    [ta('from 99.9 %', 'ab 99,9 %'), 1],
    [ta('from 99.5 %', 'ab 99,5 %'), 2],
    [`${ta('from target', 'ab Ziel')} (${formatAvailability(target, locale)})`, 3],
    [ta('below target', 'unter Ziel'), 4],
  ]
  let cursor = x
  let body = ''
  for (const [label, level] of entries) {
    body += `<rect x="${cursor}" y="${y}" width="14" height="14" rx="2" fill="${HEAT_COLOR[level]}"/>`
    body += textEl(cursor + 20, y + 11, label, { size: 11, fill: MUTED_COLOR })
    cursor += 20 + label.length * 6.4 + 16
  }
  return body
}
