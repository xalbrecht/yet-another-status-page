import React from 'react'
import { ta } from '@/lib/i18n/admin'
import { formatAvailability } from '@/lib/availability'
import type { RankingRow, ReportData } from '@/lib/report/aggregate'
import type { ReportParams } from '@/lib/report/params'
import type { ReportPeriod } from '@/lib/report/period'
import { formatDuration } from './format'
import { Heatmap } from './Heatmap'
import { TrendChart } from './TrendChart'

/**
 * Darstellung der Berichtsseite (Konzept 6). Reine Komponente: Daten, Auswahl und Auswahlfelder kommen von außen.
 */
export type ReportViewProps = {
  data: ReportData
  params: ReportParams
  period: ReportPeriod
  locale: string
  /** Auswahlfelder (ReportControls) */
  controls: React.ReactNode
}

const RANKING_VISIBLE = 10

function Delta(props: { current: number | null; previous: number | null; locale: string }) {
  const { current, previous } = props
  if (current === null || previous === null) return null
  const diff = current - previous
  const nf = new Intl.NumberFormat(props.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (Math.abs(diff) < 0.005) return <span className="availability-report__flat">{ta('= unchanged', '= unverändert')}</span>
  const better = diff > 0
  return (
    <span className={better ? 'availability-report__up' : 'availability-report__down'}>
      {better ? '▲' : '▼'} {nf.format(Math.abs(diff))} {ta('points', 'Punkte')} {better ? ta('better', 'besser') : ta('worse', 'schlechter')}
    </span>
  )
}

function Sparkline({ history }: { history: Array<number | null> }) {
  const known = history.filter((value): value is number => value !== null)
  if (known.length === 0) return null
  const W = 84
  const H = 22
  const lo = Math.min(...known, 99.5)
  const x = (index: number) => 2 + (index * (W - 4)) / Math.max(1, history.length - 1)
  const y = (value: number) => 2 + ((100 - value) / (100 - lo)) * (H - 4)
  const points = history.map((value, index) => (value === null ? null : `${x(index).toFixed(1)},${y(value).toFixed(1)}`)).filter(Boolean).join(' ')
  const lastIndex = history.length - 1
  const last = history[lastIndex]
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ta('Course of 12 months', 'Verlauf 12 Monate')}>
      <polyline points={points} fill="none" className="availability-report__line" strokeWidth={1.5} />
      {last !== null && <circle cx={x(lastIndex)} cy={y(last)} r={2.5} className="availability-report__dot" />}
    </svg>
  )
}

function RankingTable(props: { rows: RankingRow[]; maxDown: number; showGroup: boolean; locale: string }) {
  const { rows, maxDown, showGroup, locale } = props
  const nf = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (
    <table>
      <thead>
        <tr>
          <th>{ta('Service', 'Dienst')}</th>
          {showGroup && <th>{ta('Group', 'Gruppe')}</th>}
          <th>{ta('Value', 'Wert')}</th>
          <th>{ta('Previous period', 'Zeitraum davor')}</th>
          <th>{ta('Outage duration', 'Ausfalldauer')}</th>
          <th>{ta('12 months', '12 Monate')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const diff = row.availability !== null && row.previousAvailability !== null ? row.availability - row.previousAvailability : null
          return (
            <tr key={row.serviceId}>
              <td>{row.name}</td>
              {showGroup && <td className="availability-report__muted">{row.groupName}</td>}
              <td>
                <strong>{row.availability === null ? '–' : formatAvailability(row.availability, locale)}</strong>
                {row.belowTarget && <div className="availability-report__under report-below-target">{ta('below target', 'unter Ziel')}</div>}
              </td>
              <td className={diff === null || Math.abs(diff) < 0.005 ? 'availability-report__flat' : diff > 0 ? 'availability-report__up' : 'availability-report__down'}>
                {diff === null ? '–' : Math.abs(diff) < 0.005 ? '= 0,00' : `${diff > 0 ? '▲ +' : '▼ −'}${nf.format(Math.abs(diff))}`}
              </td>
              <td>
                {row.downMs > 0 ? (
                  <div className="availability-report__dur">
                    <div className="availability-report__bar" style={{ width: `${Math.max(2, Math.round((row.downMs / maxDown) * 100))}%` }} />
                    <small>
                      {row.outageCount > 0
                        ? `${formatDuration(row.downMs - row.maintenanceDownMs)} ${ta('in', 'in')} ${row.outageCount} ${ta('outage(s)', 'Ausfall/Ausfällen')}`
                        : null}
                      {row.outageCount > 1 ? `, ${ta('longest', 'längster')} ${formatDuration(row.longestOutageMs)}` : ''}
                      {row.maintenanceDownMs > 0
                        ? `${row.outageCount > 0 ? ' + ' : ''}${formatDuration(row.maintenanceDownMs)} ${ta('maintenance (counts as outage)', 'Wartung (zählt als Ausfall)')}`
                        : null}
                    </small>
                  </div>
                ) : (
                  <span className="availability-report__muted">{ta('no outage', 'kein Ausfall')}</span>
                )}
              </td>
              <td><Sparkline history={row.history} /></td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function ReportView({ data, params, period, locale, controls }: ReportViewProps) {
  const { kpis } = data
  const targetMet = kpis.availability !== null && kpis.availability >= kpis.target
  const scopeText = data.scope.groupName ?? ta('All groups', 'Alle Gruppen')
  const maxDown = Math.max(1, ...data.ranking.map((row) => row.downMs))

  return (
    <div className="availability-report">
      <h1>{ta('Availability report', 'Verfügbarkeitsbericht')} {period.label}</h1>
      <p className="availability-report__muted">
        {scopeText}, {data.scope.serviceCount} {ta('services', 'Dienste')}
        {period.partial ? `. ${ta('The period is not complete yet.', 'Der Zeitraum ist noch nicht abgeschlossen.')}` : ''}
      </p>
      {controls}

      {data.error ? (
        <p role="alert" className="availability-report__error">{data.error}</p>
      ) : (
        <>
          <section className="availability-report__kpis" aria-label={ta('Key figures', 'Kennzahlen')}>
            <div className="availability-report__kpi">
              <div className="availability-report__label">{ta('Availability', 'Verfügbarkeit')} {scopeText}</div>
              <div className="availability-report__value">{kpis.availability === null ? '–' : formatAvailability(kpis.availability, locale)}</div>
              <div><Delta current={kpis.availability} previous={kpis.previousAvailability} locale={locale} /></div>
              <div className={kpis.availability === null ? 'availability-report__muted' : targetMet ? 'availability-report__up' : 'availability-report__down'}>
                {ta('Target', 'Ziel')} {formatAvailability(kpis.target, locale)}:{' '}
                {kpis.availability === null
                  ? '–'
                  : targetMet
                    ? ta('met', 'erreicht')
                    : `${ta('missed by', 'verfehlt um')} ${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(kpis.target - kpis.availability)} ${ta('points', 'Punkte')}`}
              </div>
            </div>
            <div className="availability-report__kpi">
              <div className="availability-report__label">{ta('Outage time of all services', 'Ausfallzeit aller Dienste')}</div>
              <div className="availability-report__value">{formatDuration(kpis.downMs)}</div>
              <div className="availability-report__muted">{ta('Previous period', 'Zeitraum davor')}: {formatDuration(kpis.previousDownMs)}</div>
            </div>
            <div className="availability-report__kpi">
              <div className="availability-report__label">{ta('Affected services', 'Betroffene Dienste')}</div>
              <div className="availability-report__value">{kpis.affectedServices} <small>{ta('of', 'von')} {kpis.serviceCount}</small></div>
              <div className="availability-report__muted">{kpis.outageCount} {ta('outages', 'Ausfälle')}</div>
            </div>
            <div className="availability-report__kpi">
              <div className="availability-report__label">{ta('Longest outage', 'Längster Ausfall')}</div>
              <div className="availability-report__value">{kpis.longestOutage ? formatDuration(kpis.longestOutage.ms) : '–'}</div>
              <div className="availability-report__muted">{kpis.longestOutage?.serviceName ?? ta('no outage', 'kein Ausfall')}</div>
            </div>
            <div className="availability-report__kpi">
              <div className="availability-report__label">{ta('Months with target met', 'Monate mit erreichtem Ziel')}</div>
              <div className="availability-report__value">{kpis.monthsMet} <small>{ta('of', 'von')} {kpis.monthsTotal}</small></div>
            </div>
            <div className="availability-report__status">
              <span>{ta('Degraded Performance', 'Eingeschränkt')}: <b>{formatDuration(kpis.degradedMs)}</b></span>
              {params.showMaintenance && (
                <span data-testid="report-maintenance">{ta('Maintenance', 'Wartung')}: <b>{formatDuration(kpis.maintenanceMs)}</b></span>
              )}
            </div>
          </section>

          <section className="availability-report__card">
            <h2>{ta('The weakest services', 'Die schwächsten Dienste')} ({data.weakest.length})</h2>
            {data.weakest.length === 0 ? (
              <p className="availability-report__muted">{ta('No outage in this period.', 'Kein Ausfall in diesem Zeitraum.')}</p>
            ) : (
              <div className="availability-report__weak">
                {data.weakest.map((row) => (
                  <div key={row.serviceId}>
                    <div className="availability-report__weak-name">{row.name}</div>
                    <div className="availability-report__muted">{row.groupName}</div>
                    <div className="availability-report__weak-value">{row.availability === null ? '–' : formatAvailability(row.availability, locale)}</div>
                    <div className="availability-report__muted">
                      {formatDuration(row.downMs)} {ta('in', 'in')} {row.outageCount} {ta('outage(s)', 'Ausfall/Ausfällen')}, {ta('previous period', 'Zeitraum davor')} {row.previousAvailability === null ? '–' : formatAvailability(row.previousAvailability, locale)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="availability-report__card">
            <h2>{ta('Development of the last 12 months', 'Entwicklung der letzten 12 Monate')}</h2>
            <TrendChart trend={data.trend} target={kpis.target} locale={locale} />
          </section>

          <section className="availability-report__card">
            <h2>{data.scope.groupName ? `${ta('Services of the group', 'Dienste der Gruppe')} ${data.scope.groupName}` : ta('Heat map by service group', 'Wärmekarte nach Dienstgruppen')}</h2>
            <Heatmap heat={data.heat} target={kpis.target} locale={locale} />
          </section>

          <section className="availability-report__card" data-testid="report-ranking">
            <h2>{ta('Services, weakest first', 'Dienste, schwächste zuerst')}</h2>
            <div className="availability-report__scroll">
              <RankingTable rows={data.ranking.slice(0, RANKING_VISIBLE)} maxDown={maxDown} showGroup={!data.scope.groupName} locale={locale} />
              {data.ranking.length > RANKING_VISIBLE && (
                <details>
                  <summary>{ta('Show all services', 'Alle Dienste zeigen')} ({data.ranking.length})</summary>
                  <RankingTable rows={data.ranking.slice(RANKING_VISIBLE)} maxDown={maxDown} showGroup={!data.scope.groupName} locale={locale} />
                </details>
              )}
            </div>
          </section>

          <section className="availability-report__notes">
            <p>
              {ta('Not clearly classified incidents counted as partial outage:', 'Nicht eindeutig eingeordnete Vorfälle, als Teilausfall gewertet:')} <b>{data.footnotes.unsure}</b>.
              {' '}
              {ta('Incidents without a service, not considered:', 'Vorfälle ohne Dienst, nicht berücksichtigt:')} <b>{data.footnotes.withoutService}</b>.
            </p>
          </section>
        </>
      )}
    </div>
  )
}
