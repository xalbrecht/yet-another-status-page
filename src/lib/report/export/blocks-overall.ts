import { ta } from '@/lib/i18n/admin'
import { formatAvailability } from '@/lib/availability'
import type { RankingRow, ReportData } from '@/lib/report/aggregate'
import { formatDuration } from '@/lib/report/format'
import { chunkRows } from '@/lib/report/heat'
import { heatLegend, heatTable, heatTableHeight, trendChart } from './charts'
import { GRID_COLOR, MUTED_COLOR, SEVERITY_COLOR, TARGET_COLOR } from './palette'
import { svgDocument, textEl, truncate } from './svg'

/**
 * Bilder des Gesamtberichts (Konzept 3): Kennzahlen, Entwicklung, schwächste Dienste, Wärmekarte nach Gruppen und
 * Rangliste. Jedes Bild ist ein eigenständiges SVG, das ohne YASP in eine Folie passt.
 */
export type ExportBlock = { file: string; svg: string }

export const BLOCK_WIDTH = 1000
const CONTENT_WIDTH = 960
const TOP = 70
const WEAKEST_COLUMNS = 5
const RANKING_ROWS = 12

/** Rahmen mit Titel und Untertitel. `content` ist ab (20, 70) gezeichnet und `contentHeight` hoch. */
export function frame(title: string, subtitle: string, contentHeight: number, content: string): string {
  const header = textEl(20, 30, title, { size: 20, weight: 'bold' }) + (subtitle ? textEl(20, 50, subtitle, { size: 13, fill: MUTED_COLOR }) : '')
  return svgDocument(BLOCK_WIDTH, TOP + contentHeight + 20, `${header}<g transform="translate(20,${TOP})">${content}</g>`)
}

const nf = (locale: string) => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function kpiBlock(data: ReportData, locale: string, subtitle: string): string {
  const { kpis } = data
  const gap = 12
  const width = (CONTENT_WIDTH - 4 * gap) / 5
  const met = kpis.availability !== null && kpis.availability >= kpis.target
  const targetLine =
    kpis.availability === null
      ? ''
      : `${ta('Target', 'Ziel')} ${formatAvailability(kpis.target, locale)}: ${met ? ta('met', 'erreicht') : `${ta('missed by', 'verfehlt um')} ${nf(locale).format(kpis.target - kpis.availability)} ${ta('points', 'Punkte')}`}`
  const tiles: Array<{ label: string; value: string; lines: string[] }> = [
    {
      label: ta('Availability', 'Verfügbarkeit'),
      value: kpis.availability === null ? '–' : formatAvailability(kpis.availability, locale),
      lines: [targetLine, kpis.previousAvailability === null ? '' : `${ta('Previous period', 'Zeitraum davor')}: ${formatAvailability(kpis.previousAvailability, locale)}`],
    },
    {
      label: ta('Outage time of all services', 'Ausfallzeit aller Dienste'),
      value: formatDuration(kpis.downMs),
      lines: [`${ta('Previous period', 'Zeitraum davor')}: ${formatDuration(kpis.previousDownMs)}`],
    },
    {
      label: ta('Affected services', 'Betroffene Dienste'),
      value: `${kpis.affectedServices} ${ta('of', 'von')} ${kpis.serviceCount}`,
      lines: [`${kpis.outageCount} ${ta('outages', 'Ausfälle')}`],
    },
    {
      label: ta('Longest outage', 'Längster Ausfall'),
      value: kpis.longestOutage ? formatDuration(kpis.longestOutage.ms) : '–',
      lines: [kpis.longestOutage?.serviceName ?? ta('no outage', 'kein Ausfall')],
    },
    {
      label: ta('Months with target met', 'Monate mit erreichtem Ziel'),
      value: `${kpis.monthsMet} ${ta('of', 'von')} ${kpis.monthsTotal}`,
      lines: [],
    },
  ]
  const content = tiles
    .map((tile, index) => {
      const x = index * (width + gap)
      return (
        `<rect x="${x}" y="0" width="${width}" height="112" rx="6" fill="#fff" stroke="${GRID_COLOR}"/>` +
        textEl(x + 12, 22, truncate(tile.label, 26), { size: 11, fill: MUTED_COLOR }) +
        textEl(x + 12, 56, tile.value, { size: Math.min(26, Math.floor((width - 24) / (tile.value.length * 0.66))), weight: 'bold' }) +
        tile.lines.filter(Boolean).map((line, row) => textEl(x + 12, 78 + row * 16, truncate(line, 30), { size: 11, fill: MUTED_COLOR })).join('')
      )
    })
    .join('')
  return frame(ta('Key figures', 'Kennzahlen'), subtitle, 112, content)
}

function trendBlock(data: ReportData, locale: string, subtitle: string): string {
  return frame(ta('Development of the last 12 months', 'Entwicklung der letzten 12 Monate'), subtitle, 300, trendChart(data.trend, data.kpis.target, locale, CONTENT_WIDTH, 300))
}

function weakestBlock(data: ReportData, locale: string, subtitle: string): string {
  const title = ta('The weakest services', 'Die schwächsten Dienste')
  if (data.weakest.length === 0) {
    return frame(title, subtitle, 40, textEl(0, 24, ta('No outage in this period.', 'Kein Ausfall in diesem Zeitraum.'), { size: 14, fill: MUTED_COLOR }))
  }
  const gap = 12
  const width = (CONTENT_WIDTH - (WEAKEST_COLUMNS - 1) * gap) / WEAKEST_COLUMNS
  const rows = Math.ceil(data.weakest.length / WEAKEST_COLUMNS)
  const content = data.weakest
    .map((row, index) => {
      const x = (index % WEAKEST_COLUMNS) * (width + gap)
      const y = Math.floor(index / WEAKEST_COLUMNS) * 112
      return (
        `<rect x="${x}" y="${y}" width="${width}" height="100" rx="6" fill="#fff" stroke="${GRID_COLOR}"/>` +
        textEl(x + 12, y + 22, truncate(row.name, 22), { size: 13, weight: 'bold' }) +
        textEl(x + 12, y + 38, truncate(row.groupName, 26), { size: 11, fill: MUTED_COLOR }) +
        textEl(x + 12, y + 66, row.availability === null ? '–' : formatAvailability(row.availability, locale), { size: 22, weight: 'bold' }) +
        textEl(x + 12, y + 86, truncate(`${formatDuration(row.downMs)} ${ta('in', 'in')} ${row.outageCount} ${ta('outage(s)', 'Ausfall/Ausfällen')}`, 32), { size: 11, fill: MUTED_COLOR })
      )
    })
    .join('')
  return frame(title, subtitle, rows * 112 - 12, content)
}

function heatBlocks(data: ReportData, locale: string, subtitle: string): ExportBlock[] {
  const total = data.heat.rows.filter((row) => row.total)
  const chunks = chunkRows(data.heat.rows.filter((row) => !row.total))
  return (chunks.length > 0 ? chunks : [[]]).map((chunk, index) => {
    const rows = [...total, ...chunk]
    const tableHeight = heatTableHeight(rows.length)
    const content = heatTable(data.heat, rows, data.kpis.target, locale, CONTENT_WIDTH) + heatLegend(data.kpis.target, locale, 0, tableHeight + 14)
    const part = chunks.length > 1 ? ` (${index + 1}/${chunks.length})` : ''
    return {
      file: `04-waermekarte-gruppen-${index + 1}.png`,
      svg: frame(`${ta('Heat map by service group', 'Wärmekarte nach Dienstgruppen')}${part}`, subtitle, tableHeight + 34, content),
    }
  })
}

function changeText(row: RankingRow, locale: string): { text: string; color: string } {
  if (row.availability === null || row.previousAvailability === null) return { text: '–', color: MUTED_COLOR }
  const diff = row.availability - row.previousAvailability
  if (Math.abs(diff) < 0.005) return { text: '= 0,00', color: MUTED_COLOR }
  return { text: `${diff > 0 ? '▲ +' : '▼ −'}${nf(locale).format(Math.abs(diff))}`, color: diff > 0 ? '#1f5fae' : TARGET_COLOR }
}

function rankingBlock(data: ReportData, locale: string, subtitle: string): string {
  const rows = data.ranking.slice(0, RANKING_ROWS)
  const rowHeight = 30
  let content =
    textEl(0, 16, ta('Service', 'Dienst'), { size: 11, fill: MUTED_COLOR }) +
    textEl(300, 16, ta('Group', 'Gruppe'), { size: 11, fill: MUTED_COLOR }) +
    textEl(600, 16, ta('Value', 'Wert'), { size: 11, fill: MUTED_COLOR, anchor: 'end' }) +
    textEl(700, 16, ta('Previous period', 'Zeitraum davor'), { size: 11, fill: MUTED_COLOR, anchor: 'end' }) +
    textEl(720, 16, ta('Outage duration', 'Ausfalldauer'), { size: 11, fill: MUTED_COLOR })
  rows.forEach((row, index) => {
    const y = 24 + index * rowHeight
    const change = changeText(row, locale)
    const duration =
      row.downMs > 0
        ? `${formatDuration(row.downMs - row.maintenanceDownMs)} ${ta('in', 'in')} ${row.outageCount} ${ta('outage(s)', 'Ausfall/Ausfällen')}${row.maintenanceDownMs > 0 ? ` + ${ta('maintenance', 'Wartung')}` : ''}`
        : ta('no outage', 'kein Ausfall')
    content +=
      `<line x1="0" x2="${CONTENT_WIDTH}" y1="${y}" y2="${y}" stroke="${GRID_COLOR}"/>` +
      textEl(0, y + 19, truncate(row.name, 32), { size: 13 }) +
      textEl(300, y + 19, truncate(row.groupName, 26), { size: 12, fill: MUTED_COLOR }) +
      textEl(600, y + 19, row.availability === null ? '–' : formatAvailability(row.availability, locale), { size: 13, weight: 'bold', anchor: 'end', fill: row.belowTarget ? SEVERITY_COLOR.major : undefined }) +
      textEl(700, y + 19, change.text, { size: 12, anchor: 'end', fill: change.color }) +
      textEl(720, y + 19, truncate(duration, 38), { size: 12 })
  })
  return frame(ta('Services, weakest first', 'Dienste, schwächste zuerst'), subtitle, 24 + Math.max(1, rows.length) * rowHeight, content)
}

/** Alle Bilder des Gesamtberichts in der Reihenfolge der ZIP-Datei. `periodLabel` steht im Untertitel jedes Bildes. */
export function overallBlocks(data: ReportData, locale: string, periodLabel: string = ''): ExportBlock[] {
  const subtitle = [periodLabel, `${data.scope.serviceCount} ${ta('services', 'Dienste')}`].filter(Boolean).join(' · ')
  return [
    { file: '01-kennzahlen.png', svg: kpiBlock(data, locale, subtitle) },
    { file: '02-entwicklung-12-monate.png', svg: trendBlock(data, locale, subtitle) },
    { file: '03-schwaechste-dienste.png', svg: weakestBlock(data, locale, subtitle) },
    ...heatBlocks(data, locale, subtitle),
    { file: '05-dienste-schwaechste-zuerst.png', svg: rankingBlock(data, locale, subtitle) },
  ]
}
