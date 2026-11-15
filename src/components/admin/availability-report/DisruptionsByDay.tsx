import React from 'react'
import { ta } from '@/lib/i18n/admin'
import { serviceWord } from '@/lib/report/format'
import type { GroupSheetData } from '@/lib/report/group-sheet'

/**
 * Block 4 des Gruppenblatts: alle Tage des Monats auf der Achse, an Tagen mit Ausfall je betroffenem Dienst ein
 * schmaler Balken (Höhe in Stunden, Farbe nach Art) mit dem Dienstnamen senkrecht darunter. Ohne Ausfall entfällt der Block.
 */
const W = 1000
const LEFT = 52
const RIGHT = 10
const TOP = 16
const BASE = 170
const NAME_MAX = 16
const MAX_NAMED_BARS = 2
/** Senkrechter Name: Beginn 22 unter der Achse, rund 7 Einheiten je Zeichen, dazu etwas Luft. Sonst schneidet das SVG ihn ab. */
const HEIGHT = BASE + 22 + NAME_MAX * 7 + 8
/** Auch ein Ausfall von wenigen Minuten bleibt als Strich sichtbar. */
const MIN_BAR_HEIGHT = 2

const shortName = (name: string) => (name.length > NAME_MAX ? `${name.slice(0, NAME_MAX - 1)}…` : name)

export function DisruptionsByDay({ sheet, locale }: { sheet: GroupSheetData; locale: string }) {
  const withBars = sheet.perDay.filter((day) => day.bars.length > 0)
  if (withBars.length === 0) return null
  const maxHours = Math.max(1, Math.ceil(Math.max(...withBars.flatMap((day) => day.bars.map((bar) => bar.ms))) / 3_600_000))
  const perHour = (BASE - TOP) / maxHours
  const slot = (W - LEFT - RIGHT) / sheet.perDay.length
  const ticks = Array.from(new Set([0, Math.round(maxHours / 2), maxHours]))
  const hoursLabel = ta('h')
  const hours = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return (
    <section className="availability-report__card" data-testid="sheet-by-day">
      <h3>{ta('Disruptions in')} {sheet.month.label}, {ta('by day')}</h3>
      <svg viewBox={`0 0 ${W} ${HEIGHT}`} className="availability-report__trend" role="img" aria-label={ta('Disruptions by day')}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={LEFT} x2={W - RIGHT} y1={BASE - tick * perHour} y2={BASE - tick * perHour} className="availability-report__grid" />
            <text x={LEFT - 8} y={BASE - tick * perHour + 4} textAnchor="end">{tick} {hoursLabel}</text>
          </g>
        ))}
        {sheet.perDay.map((day, index) => {
          const center = LEFT + slot * index + slot / 2
          const count = day.bars.length
          const barWidth = Math.min(14, (slot * 0.9) / Math.max(1, count))
          const left = center - (barWidth * count) / 2
          // Ab drei Balken überlappen die senkrechten Namen: dann nur die Zahl der Dienste, die Namen stehen im Tooltip
          const showNames = count <= MAX_NAMED_BARS
          const labelled = day.bars.length > 0 || day.dayOfMonth === 1 || day.dayOfMonth % 5 === 0 || index === sheet.perDay.length - 1
          return (
            <g key={day.day}>
              {day.bars.map((bar, position) => {
                const height = Math.max(MIN_BAR_HEIGHT, (bar.ms / 3_600_000) * perHour)
                const x = left + position * barWidth
                return (
                  <g key={`${bar.serviceId}-${bar.status}`}>
                    <rect x={x} y={BASE - height} width={Math.max(1, barWidth - 1)} height={height} className={`availability-report__sev-${bar.status}`}>
                      <title>{`${bar.name}, ${day.dayOfMonth}.: ${hours.format(bar.ms / 3_600_000)} ${hoursLabel}`}</title>
                    </rect>
                    {showNames && <text transform={`translate(${x + barWidth / 2 - 4},${BASE + 22}) rotate(90)`}>{shortName(bar.name)}</text>}
                  </g>
                )
              })}
              {!showNames && <text transform={`translate(${center - 4},${BASE + 22}) rotate(90)`}>{count} {serviceWord(count)}</text>}
              {labelled && <text x={center} y={BASE + 14} textAnchor="middle">{day.dayOfMonth}</text>}
            </g>
          )
        })}
        <line x1={LEFT} x2={W - RIGHT} y1={BASE} y2={BASE} className="availability-report__grid" />
      </svg>
      <div className="availability-report__legend">
        <span><i className="availability-report__sev-major" />{ta('Major Outage')}</span>
        <span><i className="availability-report__sev-partial" />{ta('Partial Outage')}</span>
      </div>
    </section>
  )
}
