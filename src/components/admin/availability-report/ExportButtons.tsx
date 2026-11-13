import React from 'react'
import { ta } from '@/lib/i18n/admin'

/**
 * Schaltflächen für den Export (Konzept 6): ZIP mit allen Dateien, PDF und Excel einzeln, im Gruppentab zusätzlich
 * nur diese Gruppe. Die Adressen tragen die Auswahl der Seite (Zeitraum, Rechenart, Wartungsart), nicht Ansicht und Gruppe.
 */
const EXPORT_PATH = '/api/availability-report/export'
const KEPT = ['calc', 'from', 'maintenance', 'period', 'to'] as const

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

function exportHref(search: Record<string, string | string[] | undefined>, extra: Record<string, string>): string {
  const query: Record<string, string> = { ...extra }
  for (const key of KEPT) {
    const value = first(search[key])
    if (value) query[key] = value
  }
  return `${EXPORT_PATH}?${Object.keys(query)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
    .join('&')}`
}

export function ExportButtons(props: { search: Record<string, string | string[] | undefined>; groupId: number | null }) {
  const { search, groupId } = props
  return (
    <div className="availability-report__export" data-testid="report-export">
      <a href={exportHref(search, { format: 'zip' })} download>{ta('Download everything (ZIP)', 'Alles herunterladen (ZIP)')}</a>
      <a href={exportHref(search, { format: 'pdf' })} download>PDF</a>
      <a href={exportHref(search, { format: 'xlsx' })} download>Excel</a>
      {groupId !== null && (
        <a href={exportHref(search, { format: 'zip', group: String(groupId) })} download>{ta('Download this group only', 'Nur diese Gruppe herunterladen')}</a>
      )}
    </div>
  )
}
