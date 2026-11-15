import type { LoadedReport } from '@/lib/report/load'
import type { ReportParams } from '@/lib/report/params'

/**
 * Zustand der Berichtsseite aus Adresse und geladenem Bericht (Issue #116). Aus `index.tsx` herausgezogen, damit die
 * Regeln zur Gruppe ohne Payload und Anmeldung testbar sind.
 */
type Search = Record<string, string | string[] | undefined>

/** Der Gesamtbericht zeigt immer alle Gruppen: eine Gruppe in der Adresse gilt nur für die Gruppenberichte. */
export function searchForLoad(requested: Pick<ReportParams, 'view'>, search: Search): Search {
  return requested.view === 'overall' ? { ...search, group: undefined } : search
}

export function reportViewState(requested: ReportParams, result: LoadedReport) {
  // Bei ungültiger Gruppe (z. B. gelöscht, altes Lesezeichen) gilt keine Gruppe mehr: Formular und Tabs tragen sie nicht weiter
  const groupInvalid = result.ok && Boolean(result.data.error) && Boolean(requested.group)
  const reportParams: ReportParams = { ...(result.ok ? result.params : requested), ...(groupInvalid ? { group: undefined } : {}) }
  // Das Formular trägt die gewählte Gruppe auch im Gesamtbericht weiter (dort lädt der Bericht sie nicht) und in den
  // Gruppenberichten die vorgewählte, wenn die Adresse keine nennt
  const controlParams: ReportParams = { ...reportParams, group: groupInvalid ? undefined : requested.group ?? reportParams.group }
  const exportable = result.ok && !result.data.error
  return { groupInvalid, reportParams, controlParams, exportable }
}
