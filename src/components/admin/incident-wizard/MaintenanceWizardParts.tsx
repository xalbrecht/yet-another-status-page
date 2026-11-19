import React from 'react'
import { useAdminText, type AdminText } from '@/lib/i18n/admin-client'
import type { DraftTexts } from '@/lib/incident-draft'
import type { MissingMaintenanceField } from '@/lib/maintenance-draft'
import type { WizardService } from './IncidentWizardParts'

/**
 * Teile der Seite „Neu erstellen mit Vorlage“ für die Art „Wartung“: Zeitraum, Vorschau, Fertig-Ansicht. Reine Komponenten ohne
 * Zustand und ohne Stil-Import, Daten und Funktionen kommen von `MaintenanceWizard.tsx`.
 */
export function PeriodStep({
  timeZone,
  maintenanceKind,
  onMaintenanceKind,
  start,
  end,
  onStart,
  onEnd,
  startInPast,
  endBeforeStart,
  templateNeedsEnd,
}: {
  timeZone: string
  /** Gewählte Art der Wartung, leer: noch nicht gewählt (keine Vorgabe) */
  maintenanceKind: string
  onMaintenanceKind: (value: string) => void
  start: string
  end: string
  onStart: (value: string) => void
  onEnd: (value: string) => void
  startInPast: boolean
  endBeforeStart: boolean
  /** Die gewählte Vorlage nutzt `{{end}}`, ein Ende fehlt aber */
  templateNeedsEnd: boolean
}) {
  const ta = useAdminText()
  return (
    <>
      <div>
        <label className="iw-label" htmlFor="iw-kind">{ta('Maintenance type')}</label>
        <select id="iw-kind" data-testid="maintenance-kind" value={maintenanceKind} onChange={(event) => onMaintenanceKind(event.target.value)}>
          <option value="">{ta('Please choose')}</option>
          <option value="sla">{ta('Within the maintenance window (SLA)')}</option>
          <option value="additional">{ta('Additional maintenance')}</option>
        </select>
      </div>
      <div className="iw-cols">
        <div>
          <label className="iw-label" htmlFor="iw-start">{ta('Start')}</label>
          <input type="datetime-local" id="iw-start" data-testid="start" value={start} onChange={(event) => onStart(event.target.value)} />
        </div>
        <div>
          <label className="iw-label" htmlFor="iw-end">{ta('End (optional)')}</label>
          <input type="datetime-local" id="iw-end" data-testid="end" value={end} onChange={(event) => onEnd(event.target.value)} />
        </div>
      </div>
      <p className="iw-hint">{ta('Time zone of the settings: {zone}. Without an end the timer does not complete the maintenance by itself.').replace('{zone}', timeZone)}</p>
      {startInPast && <p className="iw-warn" data-testid="start-past">{ta('The start is in the past. The maintenance is "In Progress" right after it is created.')}</p>}
      {endBeforeStart && <p className="iw-error" role="alert" data-testid="end-before-start">{ta('The end must not be before the start')}</p>}
      {templateNeedsEnd && <p className="iw-warn" data-testid="needs-end">{ta('The template uses the end, but the maintenance has none. The placeholder stays empty.')}</p>}
    </>
  )
}

export function maintenanceMissingLabel(field: MissingMaintenanceField, ta: AdminText): string {
  switch (field) {
    case 'maintenance-kind':
      return ta('maintenance type')
    case 'group':
      return ta('group')
    case 'services':
      return ta('at least one service')
    case 'start':
      return ta('a valid start')
    case 'end-before-start':
      return ta('an end that is not before the start')
    case 'template':
      return ta('template')
    case 'title':
      return ta('title')
    case 'body':
      return ta('text')
    case 'sms-too-long':
      return ta('a shorter SMS text')
    default:
      return ta('a shorter ntfy text')
  }
}

export function MaintenancePreview({
  texts,
  services,
  startLabel,
  endLabel,
  startInPast,
  onBack,
  onPublish,
  busy,
  error,
}: {
  texts: DraftTexts
  services: WizardService[]
  startLabel: string
  endLabel: string
  startInPast: boolean
  onBack: () => void
  onPublish: () => void
  busy: boolean
  error: string | null
}) {
  const ta = useAdminText()
  return (
    <div data-testid="preview">
      <h1>{ta('Preview and confirmation')}</h1>
      <p className="iw-lead">{ta('This is how the maintenance appears after publishing. Nothing is saved yet.')}</p>

      <h3 className="iw-ph">{ta('1. On the status page')}</h3>
      <div className="iw-pubcard iw-pubcard--maintenance" data-testid="pubcard">
        <div className="iw-top">
          <span className="iw-ttl">{texts.title}</span>
          <span className="iw-badge">{ta('Upcoming')}</span>
        </div>
        <div className="iw-time">
          {startLabel}
          {endLabel ? ` – ${endLabel}` : ''}
        </div>
        {texts.body.split('\n').map((line, index) => (
          <p key={index}>{line}</p>
        ))}
        <div className="iw-chips">
          {services.map((service) => (
            <span className="iw-chip" key={service.id}>{service.name}</span>
          ))}
        </div>
      </div>

      <h3 className="iw-ph">{ta('2. What happens when you publish')}</h3>
      <ul className="iw-eff" data-testid="effects">
        <li>{ta('The maintenance appears on the status page immediately, with the start, the end and the announcement as the first update.')}</li>
        {startInPast && <li>{ta('The start is in the past: the maintenance changes its status right away.')}</li>}
        <li>{ta('A notification draft is created. Nothing is sent automatically: you review and send it under Notifications.')}</li>
        <li>{ta('At the start the timer sets "In Progress" and notifies the subscribers right away, at the end "Completed" (automatic start and completion stay switched on, as in the form).')}</li>
        <li>{ta('The state of the services does not change.')}</li>
      </ul>

      <h3 className="iw-ph">{ta('3. Notification draft (not sent)')}</h3>
      <div className="iw-draft" data-testid="draft">
        <details open>
          <summary>{ta('Email')}</summary>
          <pre>{`${ta('Subject')}: [${ta('Maintenance scheduled')}] ${texts.title}\n\n${texts.body}\n\n${ta('Start')}: ${startLabel}${endLabel ? `\n${ta('End')}: ${endLabel}` : ''}\n\n${ta('Link')}: ${ta('(inserted when published)')}`}</pre>
        </details>
        <details>
          <summary>{ta('SMS')} ({texts.smsBody.length})</summary>
          <pre>{texts.smsBody || ta('(none, the general SMS text from the settings is used)')}</pre>
        </details>
        <details>
          <summary>{ta('ntfy')} ({texts.ntfyBody.length})</summary>
          <pre>{texts.ntfyBody || ta('(none)')}</pre>
        </details>
      </div>

      {error && <p className="iw-error" role="alert">{error}</p>}
      <div className="iw-actions">
        <button type="button" className="iw-btn iw-btn--primary" data-testid="publish" disabled={busy} onClick={onPublish}>{ta('Publish now')}</button>
        <button type="button" className="iw-btn" data-testid="back" disabled={busy} onClick={onBack}>{ta('← Back to editing')}</button>
      </div>
    </div>
  )
}

export function MaintenanceDone({
  title,
  services,
  maintenanceUrl,
  draftsUrl,
  listUrl,
  onAgain,
}: {
  title: string
  services: WizardService[]
  maintenanceUrl: string
  draftsUrl: string
  listUrl: string
  onAgain: () => void
}) {
  const ta = useAdminText()
  return (
    <div className="iw-done" data-testid="done">
      <h1><span className="iw-ok">✓</span> {ta('Maintenance published')}</h1>
      <p>{ta('"{title}" was published.').replace('{title}', title)}</p>
      <ul>
        <li>{ta('Affected services: {services}').replace('{services}', services.map((service) => service.name).join(', '))}</li>
        <li>{ta('Notification draft created (not sent)')}</li>
      </ul>
      <div className="iw-actions">
        <a className="iw-btn" href={maintenanceUrl}>{ta('View maintenance')}</a>
        <a className="iw-btn iw-btn--primary" href={draftsUrl}>{ta('Review and send the notification')}</a>
        <a className="iw-btn" href={listUrl}>{ta('Back to the list')}</a>
        <button type="button" className="iw-btn" onClick={onAgain}>{ta('Report another maintenance')}</button>
      </div>
    </div>
  )
}
