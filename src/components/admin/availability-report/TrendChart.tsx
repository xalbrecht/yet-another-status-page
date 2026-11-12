import React from 'react'
import { ta } from '@/lib/i18n/admin'
import { formatAvailability } from '@/lib/availability'

/** Verlauf der letzten 12 Monate als Linie mit gestrichelter Zielwertlinie (SVG ohne Bibliothek). */
export function TrendChart(props: {
  trend: Array<{ key: string; label: string; availability: number | null }>
  target: number
  locale: string
}) {
  const { trend, target, locale } = props
  const W = 1000
  const H = 260
  const L = 56
  const R = 16
  const T = 14
  const B = 30
  const known = trend.map((point) => point.availability).filter((value): value is number => value !== null)
  const min = Math.floor((Math.min(...known, target) - 0.5) * 2) / 2
  const max = 100
  const x = (index: number) => L + (index * (W - L - R)) / Math.max(1, trend.length - 1)
  const y = (value: number) => T + ((max - value) / (max - min)) * (H - T - B)
  const step = max - min > 1.6 ? 0.5 : 0.25
  const grid: number[] = []
  for (let value = max; value >= min - 1e-9; value -= step) grid.push(value)
  const nf = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const points = trend.map((point, index) => (point.availability === null ? null : `${x(index)},${y(point.availability)}`)).filter(Boolean).join(' ')

  return (
    <svg data-testid="report-trend" viewBox={`0 0 ${W} ${H}`} className="availability-report__trend" role="img" aria-label={ta('Availability of the last 12 months', 'Verfügbarkeit der letzten 12 Monate')}>
      {grid.map((value) => (
        <g key={value}>
          <line x1={L} x2={W - R} y1={y(value)} y2={y(value)} className="availability-report__grid" />
          <text x={L - 8} y={y(value) + 4} textAnchor="end">{nf.format(value)}</text>
        </g>
      ))}
      <line x1={L} x2={W - R} y1={y(target)} y2={y(target)} className="availability-report__target" />
      <text x={W - R} y={y(target) - 6} textAnchor="end" className="availability-report__target-label">{ta('Target', 'Ziel')} {formatAvailability(target, locale)}</text>
      <polyline points={points} fill="none" className="availability-report__line" />
      {trend.map((point, index) =>
        point.availability === null ? null : (
          <circle key={point.key} cx={x(index)} cy={y(point.availability)} r={index === trend.length - 1 ? 5.5 : 3.5} className="availability-report__dot">
            <title>{`${point.label}: ${formatAvailability(point.availability, locale)}`}</title>
          </circle>
        ),
      )}
      {trend.map((point, index) => (
        <text key={`l-${point.key}`} x={x(index)} y={H - 8} textAnchor="middle">{point.label.slice(0, 3)}</text>
      ))}
    </svg>
  )
}
