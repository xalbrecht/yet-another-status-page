import type { MaintenanceMode } from '@/lib/report/metrics'

/**
 * Auswahl der Berichtsseite aus der Adresse (Konzept 4 und 6). Ungültige Werte fallen auf den Standard zurück.
 */
export type ReportParams = {
  period?: string
  from?: string
  to?: string
  group?: string
  /** `overall`: Gesamtbericht (Standard), `groups`: Gruppenberichte mit Gruppenliste und Gruppenblatt */
  view: 'overall' | 'groups'
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
    view: first(search.view) === 'groups' ? 'groups' : 'overall',
    calc: first(search.calc) === 'monthly' ? 'monthly' : 'whole',
    maintenance: maintenance === 'B' || maintenance === 'C' ? maintenance : 'A',
    showMaintenance: !['false', '0', 'off'].includes((first(search.showMaintenance) ?? '').toLowerCase()),
    topN: Number.isNaN(topN) ? TOP_N_DEFAULT : Math.min(TOP_N_MAX, Math.max(TOP_N_MIN, topN)),
  }
}

const REPORT_PATH = '/admin/verfuegbarkeitsbericht'

/**
 * Adresse der Berichtsseite aus der aktuellen Auswahl und Änderungen. `undefined` in `overrides` entfernt einen Wert,
 * leere Werte entfallen. Die Schlüssel stehen alphabetisch, damit gleiche Auswahl gleiche Adressen ergibt.
 */
export function reportHref(
  search: Record<string, string | string[] | undefined>,
  overrides: Record<string, string | undefined>,
): string {
  const merged: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(search)) merged[key] = first(value)
  for (const [key, value] of Object.entries(overrides)) merged[key] = value
  const query = Object.keys(merged)
    .sort()
    .filter((key) => merged[key])
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(merged[key] as string)}`)
    .join('&')
  return query ? `${REPORT_PATH}?${query}` : REPORT_PATH
}

/**
 * Adressen der beiden Tabs. Beide behalten die Auswahl samt Gruppe. Ist die Gruppe ungültig (Fehlertext statt Bericht),
 * entfällt sie, sonst führt jeder Klick wieder zum Fehler.
 */
export function reportTabHrefs(
  search: Record<string, string | string[] | undefined>,
  groupInvalid: boolean,
): { overall: string; groups: string } {
  const keep = groupInvalid ? { group: undefined } : {}
  return {
    overall: reportHref(search, { ...keep, view: 'overall' }),
    groups: reportHref(search, { ...keep, view: 'groups' }),
  }
}

const SELECTION_KEYS = ['calc', 'from', 'maintenance', 'period', 'to'] as const

/** Auswahl der Seite (Zeitraum, Rechenart, Wartungsart) als Query-String für Export und Versand, ohne Ansicht und Gruppe. */
export function selectionQuery(search: Record<string, string | string[] | undefined>): string {
  return SELECTION_KEYS.flatMap((key) => {
    const value = first(search[key])
    return value ? [`${key}=${encodeURIComponent(value)}`] : []
  }).join('&')
}
