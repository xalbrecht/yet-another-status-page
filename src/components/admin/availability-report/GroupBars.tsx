import React from 'react'
import { ta } from '@/lib/i18n/admin'
import { formatAvailability } from '@/lib/availability'
import type { RankingRow } from '@/lib/report/aggregate'
import { heatClass } from '@/lib/report/heat'
import { formatDuration } from '@/lib/report/format'
import { endedLabel } from '@/lib/report/ended-label'
import type { SheetActiveStyle } from '@/lib/report/display-settings'
import { ActiveMark } from './ActiveMark'

/**
 * Block 2 des Gruppenblatts: ein Balken je Dienst nach Verfügbarkeit, schwächste zuerst. Die Reihenfolge kommt von außen.
 * `activeStyle` „marks“: in jeder Zeile die Felder „Aktiv im Berichtszeitraum“ und „Aktiv heute“ wie in der Tabelle der Dienste.
 * „hints“: ein Hinweis nur bei Abweichung (Dienst im Zeitraum nicht aktiv). Der Hinweis „beendet am …“ steht in beiden Fällen.
 */
export function GroupBars(props: { rows: RankingRow[]; locale: string; timeZone: string; activeStyle?: SheetActiveStyle }) {
  const { rows, locale, timeZone, activeStyle = 'marks' } = props
  const yesNo = (value: boolean) => (value ? ta('yes') : ta('no'))
  return (
    <div data-testid="sheet-services">
      {activeStyle === 'marks' && rows.length > 0 && (
        <div className="availability-report__bar-head" aria-hidden="true">
          <div className="availability-report__bar-name" />
          <div className="availability-report__bar-track availability-report__bar-track--blank" />
          <div className="availability-report__bar-text" />
          <div className="availability-report__bar-mark">{ta('Active in the report period')}</div>
          <div className="availability-report__bar-mark">{ta('Active today')}</div>
        </div>
      )}
      {rows.map((row) => (
        <div key={row.serviceId} className={`availability-report__bar-row${row.endedAt !== null ? ' availability-report__row--ended' : ''}`}>
          <div className="availability-report__bar-name">
            {row.name}
            {row.endedAt !== null && <span className="availability-report__badge">{endedLabel(row.endedAt, locale, timeZone)}</span>}
            {activeStyle === 'hints' && !row.activeInPeriod && <span className="availability-report__badge">{ta('Not active in the period')}</span>}
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
          {activeStyle === 'marks' && (
            <>
              <div className="availability-report__bar-mark"><ActiveMark active={row.activeInPeriod} label={yesNo(row.activeInPeriod)} /></div>
              <div className="availability-report__bar-mark"><ActiveMark active={row.activeToday} label={yesNo(row.activeToday)} /></div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
