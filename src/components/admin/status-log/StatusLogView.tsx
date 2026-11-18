import Link from 'next/link'
import type { RebuildResult } from '@/lib/status-log-rebuild'
import type { ConversionResult } from '@/lib/maintenance-conversion'
import { useAdminText, type AdminText } from '@/lib/i18n/admin-client'
import { formatZonedDateTime } from '@/lib/zoned-format'

/**
 * Darstellung der Seite „Statusprotokoll pflegen“. Reine Komponente ohne Zustand: Die Ergebnisse und die Funktionen
 * für die Schaltflächen kommen von außen. „Ausführen“ ist erst nach einer Vorschau bedienbar, die Umwandlung
 * zusätzlich erst, wenn die Sicherung der Datenbank bestätigt ist.
 */
export type StatusLogViewProps = {
  rebuild: RebuildResult | null
  conversion: ConversionResult | null
  busy: boolean
  error?: string | null
  /** Zeitzone und Sprache der Installation für die Zeiten der Vorschau (ohne Angabe UTC und Englisch) */
  timeZone?: string
  locale?: string
  /** Zahl der gespeicherten Regeln für die automatische Einordnung (Einstellungen) */
  ruleCount?: number
  /** Haken „Die Datenbank wurde gesichert“ */
  backupConfirmed?: boolean
  onBackupConfirmed?: (confirmed: boolean) => void
  onPreviewRebuild?: () => void
  onRunRebuild?: () => void
  onPreviewConversion?: () => void
  onRunConversion?: () => void
}


/** Lesbarer Name für die Schlüssel der Zählung nach Einordnung. */
function classLabel(key: string, ta: AdminText): string {
  switch (key) {
    case 'major':
      return ta('Major Outage')
    case 'partial':
      return ta('Partial Outage')
    case 'degraded':
      return ta('Degraded Performance')
    case 'maintenance':
      return ta('Maintenance')
    case 'none':
      return ta('No impact')
    case 'partial (nicht eindeutig)':
      return `${ta('Partial Outage')} ${ta('(not clearly classified)')}`
    default:
      return key
  }
}

function reasonLabel(reason: string, ta: AdminText): string {
  if (reason === 'open') return ta('open, not resolved')
  if (reason === 'manual') return ta('classified by hand')
  if (reason === 'after-start') return ta('entered after the status log started')
  if (reason === 'end-before-start') return ta('resolved before it started')
  return reason
}

export function StatusLogView(props: StatusLogViewProps) {
  const ta = useAdminText()
  const { rebuild, conversion, busy, error } = props
  const formatTime = (iso: string) => formatZonedDateTime(iso, props.locale ?? 'en', props.timeZone ?? 'UTC')
  const canRunRebuild = !busy && rebuild !== null && rebuild.dryRun
  const canRunConversion = !busy && conversion !== null && conversion.dryRun && props.backupConfirmed === true

  return (
    <div className="status-log">
      <h1>{ta('Maintain the status log')}</h1>
      {error && <p className="status-log__error" role="alert">{error}</p>}

      <section className="status-log__section">
        <h2>{ta('Reconstruct the history before the status log')}</h2>
        <p>
          {ta(
            'The status log records when a service was disrupted. It only starts on the day it was introduced. For the time before it is empty, and the availability report would have no values there.',
          )}
        </p>
        <p>
          {ta(
            'The reconstruction fills this gap. It reads the old incidents and enters for every affected service from when to when it was disrupted and how severely.',
          )}
        </p>
        <h3>{ta('When is it needed?')}</h3>
        <ul>
          <li>{ta('After old incidents were changed, deleted or classified by hand.')}</li>
          <li>
            {ta('After the rules in the settings were changed.')}{' '}
            <span data-testid="rule-count">({ta('{count} rules saved').replace('{count}', String(props.ruleCount ?? 0))})</span>{' '}
            <Link href="/admin/globals/settings">{ta('Open the settings')}</Link>
          </li>
        </ul>
        <h3>{ta('What is changed?')}</h3>
        <ul>
          <li>{ta('Only the reconstructed entries. They are deleted and created again.')}</li>
          <li>{ta('Entries from operation and the incidents themselves stay unchanged.')}</li>
          <li>{ta('The reconstruction can be repeated as often as needed.')}</li>
        </ul>
        <p className="status-log__hint">{ta('"Preview" changes nothing and shows what "Run" would produce.')}</p>
        <div className="status-log__actions">
          <button type="button" data-testid="rebuild-preview" disabled={busy} onClick={props.onPreviewRebuild}>
            {ta('Preview')}
          </button>
          <button type="button" data-testid="rebuild-run" disabled={!canRunRebuild} onClick={props.onRunRebuild}>
            {ta('Run')}
          </button>
        </div>
        {rebuild && (
          <div data-testid="rebuild-result">
            <p>{rebuild.dryRun ? ta('Preview, nothing was written.') : ta('Executed.')}</p>
            <table>
              <tbody>
                <tr><th>{ta('Incidents', 'log')}</th><td>{rebuild.incidents}</td></tr>
                <tr><th>{ta('Entries before')}</th><td>{rebuild.reconstructedBefore}</td></tr>
                <tr><th>{ta('Entries after')}</th><td>{rebuild.reconstructedAfter}</td></tr>
                <tr><th>{ta('Not clearly classified (counted as partial outage)')}</th><td>{rebuild.unsure}</td></tr>
                <tr><th>{ta('Without service (not considered)')}</th><td>{rebuild.withoutService}</td></tr>
                {Object.entries(rebuild.counts).map(([key, value]) => (
                  <tr key={key}><th>{classLabel(key, ta)}</th><td>{value}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="status-log__section">
        <h2>{ta('Maintenances that were entered as incidents')}</h2>
        <p>
          {ta(
            'In the past some maintenances were entered as incidents. In the availability report they count as an outage although they were planned.',
          )}
        </p>
        <p>
          {ta(
            'This function turns such incidents into real maintenances. It affects resolved incidents that count as "Maintenance" by the rules in the settings. For each incident:',
          )}
        </p>
        <ul>
          <li>{ta('A completed maintenance with the same times and services is created.')}</li>
          <li>{ta('The incident is deleted.')}</li>
          <li>{ta('Afterwards the reconstruction above runs.')}</li>
          <li>{ta('No notifications are sent to subscribers.')}</li>
        </ul>
        <div className="status-log__alert" role="note">
          <strong>{ta('This cannot be undone.')}</strong>{' '}
          {ta(
            'The deleted incidents are gone. The application does not create a backup itself. Before "Run", the person who operates the server must back up the database.',
          )}
        </div>
        <label className="status-log__check" htmlFor="status-log-backup">
          <input
            id="status-log-backup"
            type="checkbox"
            data-testid="convert-backup"
            checked={props.backupConfirmed === true}
            disabled={busy}
            onChange={(event) => props.onBackupConfirmed?.(event.target.checked)}
          />
          <span>{ta('The database was backed up. I know that the conversion deletes the incidents.')}</span>
        </label>
        <p className="status-log__hint">{ta('"Run" works only after a preview and with the checkbox ticked.')}</p>
        <div className="status-log__actions">
          <button type="button" data-testid="convert-preview" disabled={busy} onClick={props.onPreviewConversion}>
            {ta('Preview')}
          </button>
          <button type="button" data-testid="convert-run" disabled={!canRunConversion} onClick={props.onRunConversion}>
            {ta('Run')}
          </button>
        </div>
        {conversion && (
          <div data-testid="convert-result">
            <p>{conversion.dryRun ? ta('Preview, nothing was changed.') : ta('Executed.')}</p>
            {conversion.rebuildError && (
              <p className="status-log__error" role="alert" data-testid="convert-rebuild-error">
                {ta('The conversion is done, but the reconstruction failed: ')}
                {conversion.rebuildError}
                {' '}
                {ta('Run the reconstruction again.')}
              </p>
            )}
            <h3>{ta('Converted')} ({conversion.converted.length})</h3>
            <table>
              <thead>
                <tr><th>{ta('Incident')}</th><th>{ta('Services')}</th><th>{ta('From')}</th><th>{ta('To')}</th></tr>
              </thead>
              <tbody>
                {conversion.converted.map((entry) => (
                  <tr key={entry.incidentId}>
                    <td>{entry.title}</td><td>{entry.services}</td><td>{formatTime(entry.from)}</td><td>{formatTime(entry.to)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3>{ta('Skipped')} ({conversion.skipped.length})</h3>
            <table>
              <tbody>
                {conversion.skipped.map((entry) => (
                  <tr key={entry.incidentId}><td>{entry.title}</td><td>{reasonLabel(entry.reason, ta)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
