import { ta } from '@/lib/i18n/admin'
import { formatAvailability } from '@/lib/availability'
import type { ReportData } from '@/lib/report/aggregate'
import { formatDuration } from '@/lib/report/format'
import type { GroupSheetData } from '@/lib/report/group-sheet'
import { chunkRows, heatClass } from '@/lib/report/heat'
import { BLOCK_WIDTH, frame, type ExportBlock } from './blocks-overall'
import { heatLegend, heatTable, heatTableHeight, trendChart } from './charts'
import { BAR_COLOR, GRID_COLOR, MUTED_COLOR, SEVERITY_COLOR, TRACK_COLOR } from './palette'
import { svgDocument, textEl, truncate } from './svg'

/**
 * Bilder eines Gruppenblatts (Konzept 4): jeder Block einzeln und das ganze Blatt untereinander. Die Blöcke 3 und 4
 * fehlen, wenn die Gruppe im Monat keine Störung hatte. Block 4 steht einzeln nur mit den Tagen mit Ausfall, im
 * Gruppenblatt mit allen Tagen des Monats.
 */
type Section = { title: string; height: number; body: string }

const CONTENT_WIDTH = 960
const ROW_HEIGHT = 28
const TRACK_X = 250
const TRACK_WIDTH = 420
const NAME_MAX = 16
const MAX_NAMED_BARS = 2
const DAY_BASE = 170

const hoursOf = (ms: number) => ms / 3_600_000

function trendSection(data: ReportData, locale: string): Section {
  return {
    title: ta('Development of the last 12 months', 'Entwicklung der letzten 12 Monate'),
    height: 300,
    body: trendChart(data.trend, data.kpis.target, locale, CONTENT_WIDTH, 300),
  }
}

function servicesSection(data: ReportData, locale: string): Section {
  const body = data.ranking
    .map((row, index) => {
      const y = index * ROW_HEIGHT
      const share = row.availability === null ? 0 : Math.max(0, Math.min(100, row.availability)) / 100
      const duration =
        row.downMs > 0
          ? `${formatDuration(row.downMs - row.maintenanceDownMs)}${row.maintenanceDownMs > 0 ? ` + ${formatDuration(row.maintenanceDownMs)} ${ta('maintenance', 'Wartung')}` : ''}`
          : ta('no outage', 'kein Ausfall')
      return (
        textEl(TRACK_X - 10, y + 17, truncate(row.name, 28), { size: 12, anchor: 'end' }) +
        `<rect data-row="service" x="${TRACK_X}" y="${y + 3}" width="${TRACK_WIDTH}" height="18" fill="${TRACK_COLOR}"/>` +
        `<rect x="${TRACK_X}" y="${y + 3}" width="${TRACK_WIDTH * share}" height="18" fill="${BAR_COLOR[heatClass(row.availability, row.target)]}"/>` +
        textEl(TRACK_X + TRACK_WIDTH + 14, y + 17, truncate(`${row.availability === null ? '–' : formatAvailability(row.availability, locale)} · ${duration}`, 40), { size: 12, fill: MUTED_COLOR })
      )
    })
    .join('')
  return { title: ta('Services of the group, weakest first', 'Dienste der Gruppe, schwächste zuerst'), height: Math.max(1, data.ranking.length) * ROW_HEIGHT, body }
}

function severityLegend(x: number, y: number, withDegraded: boolean): string {
  const entries: Array<[string, string]> = [
    [ta('Major Outage', 'Schwerer Ausfall'), SEVERITY_COLOR.major],
    [ta('Partial Outage', 'Teilausfall'), SEVERITY_COLOR.partial],
  ]
  if (withDegraded) entries.push([ta('Degraded Performance', 'Eingeschränkt'), SEVERITY_COLOR.degraded])
  let cursor = x
  let body = ''
  for (const [label, color] of entries) {
    body += `<rect x="${cursor}" y="${y}" width="14" height="14" rx="2" fill="${color}"/>` + textEl(cursor + 20, y + 11, label, { size: 11, fill: MUTED_COLOR })
    cursor += 20 + label.length * 6.4 + 16
  }
  return body
}

function byServiceSection(sheet: GroupSheetData): Section | null {
  if (sheet.perService.length === 0) return null
  const total = (entry: GroupSheetData['perService'][number]) => entry.majorMs + entry.partialMs + entry.degradedMs
  const widest = Math.max(...sheet.perService.map(total))
  const scale = (ms: number) => (TRACK_WIDTH * ms) / widest
  const rows = sheet.perService
    .map((entry, index) => {
      const y = index * ROW_HEIGHT
      let x = TRACK_X
      let bars = ''
      for (const [ms, color] of [[entry.majorMs, SEVERITY_COLOR.major], [entry.partialMs, SEVERITY_COLOR.partial], [entry.degradedMs, SEVERITY_COLOR.degraded]] as const) {
        if (ms <= 0) continue
        bars += `<rect x="${x}" y="${y + 3}" width="${scale(ms)}" height="18" fill="${color}"/>`
        x += scale(ms)
      }
      return textEl(TRACK_X - 10, y + 17, truncate(entry.name, 28), { size: 12, anchor: 'end' }) + bars + textEl(x + 10, y + 17, formatDuration(total(entry)), { size: 12, fill: MUTED_COLOR })
    })
    .join('')
  const height = sheet.perService.length * ROW_HEIGHT + 30
  return {
    title: `${ta('Disruptions in', 'Störungen im')} ${sheet.month.label}, ${ta('by service', 'je Dienst')}`,
    height,
    body: rows + severityLegend(TRACK_X, height - 18, sheet.perService.some((entry) => entry.degradedMs > 0)),
  }
}

/** Block 4. `all-days`: alle Tage des Monats auf der Achse, `disruption-days`: nur Tage mit Ausfall. Ohne Ausfall `null`. */
function byDaySection(sheet: GroupSheetData, mode: 'all-days' | 'disruption-days'): Section | null {
  const withBars = sheet.perDay.filter((day) => day.bars.length > 0)
  if (withBars.length === 0) return null
  const days = mode === 'all-days' ? sheet.perDay : withBars
  const left = 52
  const right = 10
  const maxHours = Math.max(1, Math.ceil(hoursOf(Math.max(...withBars.flatMap((day) => day.bars.map((bar) => bar.ms))))))
  const perHour = (DAY_BASE - 16) / maxHours
  const slot = (CONTENT_WIDTH - left - right) / days.length
  const hoursLabel = ta('h', 'Std.')
  let body = ''
  let longestLabel = 0 // Zeichen des längsten senkrechten Textes, bestimmt die Höhe unter der Achse
  for (const hours of new Set([0, Math.round(maxHours / 2), maxHours])) {
    const y = DAY_BASE - hours * perHour
    body += `<line x1="${left}" x2="${CONTENT_WIDTH - right}" y1="${y}" y2="${y}" stroke="${GRID_COLOR}"/>` + textEl(left - 8, y + 4, `${hours} ${hoursLabel}`, { size: 11, anchor: 'end', fill: MUTED_COLOR })
  }
  days.forEach((day, index) => {
    const center = left + slot * index + slot / 2
    const count = day.bars.length
    const barWidth = Math.min(14, (slot * 0.9) / Math.max(1, count))
    const start = center - (barWidth * count) / 2
    const showNames = count <= MAX_NAMED_BARS
    day.bars.forEach((bar, position) => {
      const barHeight = hoursOf(bar.ms) * perHour
      const x = start + position * barWidth
      body += `<rect data-bar="1" x="${x}" y="${DAY_BASE - barHeight}" width="${Math.max(1, barWidth - 1)}" height="${barHeight}" fill="${SEVERITY_COLOR[bar.status]}"/>`
      if (showNames) {
        const label = truncate(bar.name, NAME_MAX)
        longestLabel = Math.max(longestLabel, label.length)
        body += textEl(x + barWidth / 2 + 4, DAY_BASE + 22, label, { size: 12, rotate: 90 })
      }
    })
    if (!showNames) {
      const label = `${count} ${ta('services', 'Dienste')}`
      longestLabel = Math.max(longestLabel, label.length)
      body += textEl(center + 4, DAY_BASE + 22, label, { size: 12, rotate: 90 })
    }
    const labelled = mode === 'disruption-days' || count > 0 || day.dayOfMonth === 1 || day.dayOfMonth % 5 === 0 || index === days.length - 1
    if (labelled) body += textEl(center, DAY_BASE + 14, String(day.dayOfMonth), { size: 11, anchor: 'middle', fill: MUTED_COLOR })
  })
  const height = DAY_BASE + 22 + Math.ceil(longestLabel * 7.8) + 40
  body += `<line x1="${left}" x2="${CONTENT_WIDTH - right}" y1="${DAY_BASE}" y2="${DAY_BASE}" stroke="${GRID_COLOR}"/>` + severityLegend(left, height - 18, false)
  return { title: `${ta('Disruptions in', 'Störungen im')} ${sheet.month.label}, ${ta('by day', 'je Tag')}`, height, body }
}

function heatSections(data: ReportData, locale: string): Section[] {
  const total = data.heat.rows.filter((row) => row.total)
  const chunks = chunkRows(data.heat.rows.filter((row) => !row.total))
  return (chunks.length > 0 ? chunks : [[]]).map((chunk, index) => {
    const rows = [...total, ...chunk]
    const tableHeight = heatTableHeight(rows.length)
    const part = chunks.length > 1 ? ` (${index + 1}/${chunks.length})` : ''
    return {
      title: `${ta('Heat map of the services', 'Wärmekarte der Dienste')}${part}`,
      height: tableHeight + 34,
      body: heatTable(data.heat, rows, data.kpis.target, locale, CONTENT_WIDTH) + heatLegend(data.kpis.target, locale, 0, tableHeight + 14),
    }
  })
}

/** Das ganze Blatt: Kopfzeile, danach alle Abschnitte untereinander. */
function sheetImage(name: string, meta: string, sections: Section[]): string {
  let y = 70
  let body = textEl(20, 30, `${ta('Group sheet', 'Gruppenblatt')}: ${truncate(name, 60)}`, { size: 20, weight: 'bold' }) + textEl(20, 50, meta, { size: 13, fill: MUTED_COLOR })
  for (const section of sections) {
    body += textEl(20, y + 16, section.title, { size: 15, weight: 'bold' }) + `<g transform="translate(20,${y + 30})">${section.body}</g>`
    y += 30 + section.height + 24
  }
  return svgDocument(BLOCK_WIDTH, y, body)
}

/** Alle Bilder einer Gruppe in der Reihenfolge der ZIP-Datei. */
export function groupBlocks(data: ReportData, locale: string, periodLabel: string = ''): ExportBlock[] {
  const name = data.scope.groupName ?? ''
  const subtitle = [name, periodLabel].filter(Boolean).join(' · ')
  const meta = [
    periodLabel,
    `${ta('Availability', 'Verfügbarkeit')} ${data.kpis.availability === null ? '–' : formatAvailability(data.kpis.availability, locale)}`,
    `${ta('Target', 'Ziel')} ${formatAvailability(data.kpis.target, locale)}`,
    `${data.scope.serviceCount} ${data.scope.serviceCount === 1 ? ta('service', 'Dienst') : ta('services', 'Dienste')}`,
  ]
    .filter(Boolean)
    .join(' · ')
  const trend = trendSection(data, locale)
  const services = servicesSection(data, locale)
  const byService = data.sheet ? byServiceSection(data.sheet) : null
  const byDayAll = data.sheet ? byDaySection(data.sheet, 'all-days') : null
  const byDaySingle = data.sheet ? byDaySection(data.sheet, 'disruption-days') : null
  const heats = heatSections(data, locale)

  const image = (section: Section) => frame(section.title, subtitle, section.height, section.body)
  const blocks: ExportBlock[] = [
    { file: '00-gruppenblatt.png', svg: sheetImage(name, meta, [trend, services, ...(byService ? [byService] : []), ...(byDayAll ? [byDayAll] : []), ...heats]) },
    { file: '01-entwicklung-12-monate.png', svg: image(trend) },
    { file: '02-dienste-schwaechste-zuerst.png', svg: image(services) },
  ]
  if (byService) blocks.push({ file: '03-stoerungen-je-dienst.png', svg: image(byService) })
  if (byDaySingle) blocks.push({ file: '04-stoerungen-je-tag.png', svg: image(byDaySingle) })
  heats.forEach((section, index) => blocks.push({ file: `05-waermekarte-dienste${index === 0 ? '' : `-${index + 1}`}.png`, svg: image(section) }))
  return blocks
}
