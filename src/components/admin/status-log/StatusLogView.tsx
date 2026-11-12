import type { RebuildResult } from '@/lib/status-log-rebuild'
import type { ConversionResult } from '@/lib/maintenance-conversion'
import { ta } from '@/lib/i18n/admin'

/**
 * Darstellung der Seite „Statusprotokoll pflegen“. Reine Komponente ohne Zustand: Die Ergebnisse und die Funktionen
 * für die Schaltflächen kommen von außen. „Ausführen“ ist erst nach einer Vorschau bedienbar.
 */
export type StatusLogViewProps = {
  rebuild: RebuildResult | null
  conversion: ConversionResult | null
  busy: boolean
  error?: string | null
  onPreviewRebuild?: () => void
  onRunRebuild?: () => void
  onPreviewConversion?: () => void
  onRunConversion?: () => void
}

const formatTime = (iso: string) => `${new Date(iso).toISOString().slice(0, 16).replace('T', ' ')} UTC`

/** Lesbarer Name für die Schlüssel der Zählung nach Einordnung. */
function classLabel(key: string): string {
  switch (key) {
    case 'major':
      return ta('Major Outage')
    case 'partial':
      return ta('Partial Outage')
    case 'degraded':
      return ta('Degraded Performance')
    case 'maintenance':
      return ta('Maintenance', 'Wartung')
    case 'none':
      return ta('No impact', 'Keine Auswirkung')
    case 'partial (nicht eindeutig)':
      return `${ta('Partial Outage')} ${ta('(not clearly classified)', '(nicht eindeutig)')}`
    default:
      return key
  }
}

function reasonLabel(reason: string): string {
  if (reason === 'open') return ta('open, not resolved', 'offen, nicht behoben')
  if (reason === 'manual') return ta('classified by hand', 'von Hand eingeordnet')
  return reason
}

export function StatusLogView(props: StatusLogViewProps) {
  const { rebuild, conversion, busy, error } = props
  const canRunRebuild = !busy && rebuild !== null && rebuild.dryRun
  const canRunConversion = !busy && conversion !== null && conversion.dryRun

  return (
    <div className="status-log">
      <h1>{ta('Maintain the status log', 'Statusprotokoll pflegen')}</h1>
      {error && <p className="status-log__error" role="alert">{error}</p>}

      <section className="status-log__section">
        <h2>{ta('Reconstruction', 'Nachrechnung')}</h2>
        <p>
          {ta(
            'Recalculates the availability history before the first operation entry of each service from the incidents. Entries from operation stay unchanged. A classification set by hand on an incident always applies.',
            'Rechnet den Verfügbarkeitsverlauf vor dem ersten Betriebseintrag jedes Dienstes aus den Vorfällen neu. Einträge aus dem Betrieb bleiben unverändert. Eine Einordnung von Hand am Vorfall gilt immer.',
          )}
        </p>
        <div className="status-log__actions">
          <button type="button" data-testid="rebuild-preview" disabled={busy} onClick={props.onPreviewRebuild}>
            {ta('Preview', 'Vorschau')}
          </button>
          <button type="button" data-testid="rebuild-run" disabled={!canRunRebuild} onClick={props.onRunRebuild}>
            {ta('Run', 'Ausführen')}
          </button>
        </div>
        {rebuild && (
          <div data-testid="rebuild-result">
            <p>{rebuild.dryRun ? ta('Preview, nothing was written.', 'Vorschau, es wurde nichts geschrieben.') : ta('Executed.', 'Ausgeführt.')}</p>
            <table>
              <tbody>
                <tr><th>{ta('Incidents', 'Vorfälle')}</th><td>{rebuild.incidents}</td></tr>
                <tr><th>{ta('Entries before', 'Einträge vorher')}</th><td>{rebuild.reconstructedBefore}</td></tr>
                <tr><th>{ta('Entries after', 'Einträge nachher')}</th><td>{rebuild.reconstructedAfter}</td></tr>
                <tr><th>{ta('Not clearly classified (counted as partial outage)', 'Nicht eindeutig eingeordnet (als Teilausfall gewertet)')}</th><td>{rebuild.unsure}</td></tr>
                <tr><th>{ta('Without service (not considered)', 'Ohne Dienst (nicht berücksichtigt)')}</th><td>{rebuild.withoutService}</td></tr>
                {Object.entries(rebuild.counts).map(([key, value]) => (
                  <tr key={key}><th>{classLabel(key)}</th><td>{value}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="status-log__section">
        <h2>{ta('Maintenances entered as incidents', 'Wartungen aus Störungen')}</h2>
        <p>
          {ta(
            'Turns resolved incidents with "Wartung" in the title into completed maintenances without notification drafts, deletes the incident and reconstructs the log. Create a backup first.',
            'Wandelt gelöste Störungen mit „Wartung“ im Titel in abgeschlossene Wartungen um, ohne Benachrichtigungsentwurf, löscht die Störung und rechnet das Protokoll neu nach. Vorher eine Sicherung anlegen.',
          )}
        </p>
        <div className="status-log__actions">
          <button type="button" data-testid="convert-preview" disabled={busy} onClick={props.onPreviewConversion}>
            {ta('Preview', 'Vorschau')}
          </button>
          <button type="button" data-testid="convert-run" disabled={!canRunConversion} onClick={props.onRunConversion}>
            {ta('Run', 'Ausführen')}
          </button>
        </div>
        {conversion && (
          <div data-testid="convert-result">
            <p>{conversion.dryRun ? ta('Preview, nothing was changed.', 'Vorschau, es wurde nichts geändert.') : ta('Executed.', 'Ausgeführt.')}</p>
            <h3>{ta('Converted', 'Umgewandelt')} ({conversion.converted.length})</h3>
            <table>
              <thead>
                <tr><th>{ta('Incident', 'Störung')}</th><th>{ta('Services', 'Dienste')}</th><th>{ta('From', 'Von')}</th><th>{ta('To', 'Bis')}</th></tr>
              </thead>
              <tbody>
                {conversion.converted.map((entry) => (
                  <tr key={entry.incidentId}>
                    <td>{entry.title}</td><td>{entry.services}</td><td>{formatTime(entry.from)}</td><td>{formatTime(entry.to)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3>{ta('Skipped', 'Übersprungen')} ({conversion.skipped.length})</h3>
            <table>
              <tbody>
                {conversion.skipped.map((entry) => (
                  <tr key={entry.incidentId}><td>{entry.title}</td><td>{reasonLabel(entry.reason)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
