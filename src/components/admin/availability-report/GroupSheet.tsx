import React from 'react'
import { ta } from '@/lib/i18n/admin'
import { formatAvailability } from '@/lib/availability'
import type { ReportData } from '@/lib/report/aggregate'
import { DisruptionsByDay } from './DisruptionsByDay'
import { DisruptionsByService } from './DisruptionsByService'
import { GroupBars } from './GroupBars'
import { Heatmap } from './Heatmap'
import { TrendChart } from './TrendChart'

/** Gruppenblatt (Konzept 4): fünf Blöcke einer Gruppe. Die Daten sind der Bericht für die gewählte Gruppe (`scope.groupName` gesetzt). */
export function GroupSheet({ data, locale }: { data: ReportData; locale: string }) {
  const { kpis, scope, sheet } = data
  return (
    <article className="availability-report__sheet" data-testid="group-sheet">
      <h2>{ta('Group sheet', 'Gruppenblatt')}: {scope.groupName}</h2>
      <p className="availability-report__muted">
        {ta('Availability', 'Verfügbarkeit')} {kpis.availability === null ? '–' : formatAvailability(kpis.availability, locale)}, {ta('Target', 'Ziel')} {formatAvailability(kpis.target, locale)}, {scope.serviceCount} {ta('services', 'Dienste')}
      </p>
      <section className="availability-report__card">
        <h3>{ta('Development of the last 12 months', 'Entwicklung der letzten 12 Monate')}</h3>
        <TrendChart trend={data.trend} target={kpis.target} locale={locale} />
      </section>
      <section className="availability-report__card">
        <h3>{ta('Services of the group, weakest first', 'Dienste der Gruppe, schwächste zuerst')}</h3>
        <GroupBars rows={data.ranking} locale={locale} />
      </section>
      {sheet && <DisruptionsByService sheet={sheet} />}
      {sheet && <DisruptionsByDay sheet={sheet} />}
      <section className="availability-report__card">
        <h3>{ta('Heat map of the services', 'Wärmekarte der Dienste')}</h3>
        <Heatmap heat={data.heat} target={kpis.target} locale={locale} />
      </section>
    </article>
  )
}
