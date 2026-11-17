import React from 'react'
import { ta } from '@/lib/i18n/admin'
import { formatAvailability } from '@/lib/availability'
import type { RankingRow } from '@/lib/report/aggregate'
import { heatClass } from '@/lib/report/heat'
import { formatDuration } from '@/lib/report/format'
import { endedLabel } from '@/lib/report/ended-label'

/** Block 2 des Gruppenblatts: ein Balken je Dienst nach Verfügbarkeit, schwächste zuerst. Die Reihenfolge kommt von außen. */
export function GroupBars(props: { rows: RankingRow[]; locale: string; timeZone: string }) {
  const { rows, locale, timeZone } = props
  return (
    <div data-testid="sheet-services">
      {rows.map((row) => (
        <div key={row.serviceId} className={`availability-report__bar-row${row.endedAt !== null ? ' availability-report__row--ended' : ''}`}>
          <div className="availability-report__bar-name">
            {row.name}
            {row.endedAt !== null && <span className="availability-report__badge">{endedLabel(row.endedAt, locale, timeZone)}</span>}
          </div>
          <div className="availability-report__bar-track">
            <div className={`availability-report__bar-fill heat-${heatClass(row.availability, row.target)}`} style={{ width: `${row.availability === null ? 0 : Math.max(2, Math.min(100, row.availability))}%` }} />
          </div>
          <div className="availability-report__bar-text">
            {row.availability === null ? '–' : formatAvailability(row.availability, locale)}
            {' · '}
            {row.downMs - row.maintenanceDownMs > 0 ? formatDuration(row.downMs - row.maintenanceDownMs) : ta('no outage')}
            {row.maintenanceDownMs > 0 && ` + ${formatDuration(row.maintenanceDownMs)} ${ta('maintenance (counts as outage)')}`}
          </div>
        </div>
      ))}
    </div>
  )
}
