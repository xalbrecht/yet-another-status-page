import type { MaintenanceMode } from '@/lib/report/metrics'

/**
 * Auswahl der Berichtsseite aus der Adresse (Konzept 4 und 6). Ungültige Werte fallen auf den Standard zurück.
 */
export type ReportParams = {
  period?: string
  from?: string
  to?: string
  group?: string
  /** `whole`: ein Wert für den ganzen Zeitraum (Standard), `monthly`: Mittel der Monatswerte */
  calc: 'whole' | 'monthly'
  maintenance: MaintenanceMode
  showMaintenance: boolean
  topN: number
}

export const TOP_N_MIN = 3
export const TOP_N_MAX = 10
export const TOP_N_DEFAULT = 5

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value)

export function parseReportParams(search: Record<string, string | string[] | undefined>): ReportParams {
  const maintenance = first(search.maintenance)?.toUpperCase()
  const topN = Number.parseInt(first(search.topN) ?? '', 10)
  const clean = (value: string | undefined) => (value && value.trim() ? value.trim() : undefined)
  return {
    period: clean(first(search.period)),
    from: clean(first(search.from)),
    to: clean(first(search.to)),
    group: clean(first(search.group)),
    calc: first(search.calc) === 'monthly' ? 'monthly' : 'whole',
    maintenance: maintenance === 'B' || maintenance === 'C' ? maintenance : 'A',
    showMaintenance: !['false', '0', 'off'].includes((first(search.showMaintenance) ?? '').toLowerCase()),
    topN: Number.isNaN(topN) ? TOP_N_DEFAULT : Math.min(TOP_N_MAX, Math.max(TOP_N_MIN, topN)),
  }
}
