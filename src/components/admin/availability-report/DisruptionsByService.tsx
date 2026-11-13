import React from 'react'
import { ta } from '@/lib/i18n/admin'
import type { GroupSheetData } from '@/lib/report/group-sheet'
import { formatDuration } from '@/lib/report/format'

/** Block 3 des Gruppenblatts: je Dienst ein Balken, aufgeteilt nach Schwerer Ausfall, Teilausfall und Eingeschränkt. Ohne Störungen entfällt der Block. */
export function DisruptionsByService({ sheet }: { sheet: GroupSheetData }) {
  if (sheet.perService.length === 0) return null
  const total = (entry: GroupSheetData['perService'][number]) => entry.majorMs + entry.partialMs + entry.degradedMs
  const widest = Math.max(...sheet.perService.map(total))
  const share = (ms: number) => `${(ms / widest) * 100}%`
  return (
    <section className="availability-report__card" data-testid="sheet-by-service">
      <h3>{ta('Disruptions in', 'Störungen im')} {sheet.month.label}, {ta('by service', 'je Dienst')}</h3>
      {sheet.perService.map((entry) => (
        <div key={entry.serviceId} className="availability-report__bar-row">
          <div className="availability-report__bar-name">{entry.name}</div>
          <div className="availability-report__bar-track availability-report__bar-stack">
            <span className="availability-report__sev-major" style={{ width: share(entry.majorMs) }} />
            <span className="availability-report__sev-partial" style={{ width: share(entry.partialMs) }} />
            <span className="availability-report__sev-degraded" style={{ width: share(entry.degradedMs) }} />
          </div>
          <div className="availability-report__bar-text">{formatDuration(total(entry))}</div>
        </div>
      ))}
      <div className="availability-report__legend">
        <span><i className="availability-report__sev-major" />{ta('Major Outage', 'Schwerer Ausfall')}</span>
        <span><i className="availability-report__sev-partial" />{ta('Partial Outage', 'Teilausfall')}</span>
        <span><i className="availability-report__sev-degraded" />{ta('Degraded Performance', 'Eingeschränkt')}</span>
      </div>
    </section>
  )
}
