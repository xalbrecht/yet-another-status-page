import React from 'react'
import { ta } from '@/lib/i18n/admin'
import { formatAvailability } from '@/lib/availability'
import type { RankingRow } from '@/lib/report/aggregate'
import { heatClass } from '@/lib/report/heat'
import { formatDuration } from './format'

/** Block 2 des Gruppenblatts: ein Balken je Dienst nach Verfügbarkeit, schwächste zuerst. Die Reihenfolge kommt von außen. */
export function GroupBars(props: { rows: RankingRow[]; locale: string }) {
  const { rows, locale } = props
  return (
    <div data-testid="sheet-services">
      {rows.map((row) => (
        <div key={row.serviceId} className="availability-report__bar-row">
          <div className="availability-report__bar-name">{row.name}</div>
          <div className="availability-report__bar-track">
            <div className={`availability-report__bar-fill heat-${heatClass(row.availability, row.target)}`} style={{ width: `${row.availability === null ? 0 : Math.max(2, Math.min(100, row.availability))}%` }} />
          </div>
          <div className="availability-report__bar-text">
            {row.availability === null ? '–' : formatAvailability(row.availability, locale)}
            {' · '}
            {row.downMs > 0 ? formatDuration(row.downMs) : ta('no outage', 'kein Ausfall')}
          </div>
        </div>
      ))}
    </div>
  )
}
