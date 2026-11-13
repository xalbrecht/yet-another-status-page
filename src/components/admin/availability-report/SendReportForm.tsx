import React from 'react'
import { ta } from '@/lib/i18n/admin'

/**
 * Darstellung des Mailversands auf der Berichtsseite (Issue #65). Reine Komponente: der Zustand kommt von außen
 * (SendReportButton). Bei jedem Fehler erklärt sie den Grund und bietet nur die Schritte an, die möglich sind.
 */
export type SendState =
  | { kind: 'idle' }
  | { kind: 'confirm' }
  | { kind: 'sending' }
  | { kind: 'done'; message: string; rejected?: string[] }
  | { kind: 'error'; code: string; message: string; sent?: number; mails?: number; nextMail?: number }

export type SendReportFormProps = {
  recipients: string[]
  state: SendState
  onAsk?: () => void
  onCancel?: () => void
  onConfirm?: () => void
  onResume?: () => void
  onRestart?: () => void
}

/** Link auf die E-Mail-Einstellungen (Slug `email-settings`). */
const SETTINGS_HREF = '/admin/globals/email-settings'

function ErrorBox(props: { state: Extract<SendState, { kind: 'error' }>; onResume?: () => void; onRestart?: () => void }) {
  const { state, onResume, onRestart } = props
  // Die Route zählt nur die Mails dieses Aufrufs. Gesendet ist alles vor der nächsten Mail, auch aus früheren Versuchen.
  const sent = state.nextMail !== undefined ? state.nextMail - 1 : state.sent ?? 0
  if (state.code === 'plan-changed') {
    return (
      <div role="alert" className="availability-report__send-error">
        <p>
          {ta(
            'The dispatch cannot be continued: the data of the report changed since the first attempt (for example a new entry in the status log). The emails already sent belong to an older state. Please restart the whole dispatch. The recipients then receive all emails again, recognizable by "Part i of n".',
            'Der Versand lässt sich nicht fortsetzen: Seit dem ersten Versuch haben sich die Daten des Berichts geändert (z. B. ein neuer Eintrag im Statusprotokoll). Die bereits gesendeten Mails gehören zu einem älteren Stand. Bitte den ganzen Versand neu starten. Die Empfänger erhalten dann alle Mails erneut, erkennbar an „Teil i von n“.',
          )}
        </p>
        <button type="button" onClick={onRestart}>{ta('Send again from the start', 'Neu senden')}</button>
      </div>
    )
  }
  if (state.code === 'send-failed') {
    const resumable = (state.nextMail ?? 1) > 1 && state.mails !== undefined
    return (
      <div role="alert" className="availability-report__send-error">
        <p>
          {resumable
            ? `${sent} ${ta('of', 'von')} ${state.mails} ${ta('emails are out, email', 'Mails sind raus, Mail')} ${state.nextMail} ${ta('did not arrive', 'ist nicht angekommen')}: ${state.message}.`
            : `${ta('No email went out', 'Es ging keine Mail raus')}: ${state.message}.`}
        </p>
        {resumable ? (
          <button type="button" onClick={onResume}>{`${ta('Send the rest (from email', 'Rest senden (ab Mail')} ${state.nextMail} ${ta('of', 'von')} ${state.mails})`}</button>
        ) : (
          <button type="button" onClick={onRestart}>{ta('Send again', 'Erneut senden')}</button>
        )}
      </div>
    )
  }
  if (state.code === 'unknown-state') {
    return (
      <div role="alert" className="availability-report__send-error">
        <p>
          {ta(
            'Status unknown: the answer of the server is missing. The dispatch may still be running or may be partly done. Please check with the recipients before you start a new dispatch.',
            'Stand unbekannt: Die Antwort des Servers fehlt. Der Versand läuft möglicherweise noch oder ist teilweise erfolgt. Bitte bei den Empfängern nachsehen, bevor ein neuer Versand gestartet wird.',
          )}
        </p>
      </div>
    )
  }
  const text =
    state.code === 'running'
      ? ta('A dispatch is already running. Please wait until it is finished (about a minute) and reload the page.', 'Es läuft bereits ein Versand. Bitte warten, bis er fertig ist (rund eine Minute), und die Seite dann neu laden.')
      : state.message
  return (
    <div role="alert" className="availability-report__send-error">
      <p>{text}</p>
    </div>
  )
}

export function SendReportForm(props: SendReportFormProps) {
  const { recipients, state, onAsk, onCancel, onConfirm, onResume, onRestart } = props
  if (recipients.length === 0) {
    return (
      <div className="availability-report__send" data-testid="report-send">
        <p className="availability-report__muted">
          {ta('No recipients entered.', 'Keine Empfänger eingetragen.')} <a href={SETTINGS_HREF}>{ta('Open the email settings', 'E-Mail-Einstellungen öffnen')}</a>
        </p>
      </div>
    )
  }
  return (
    <div className="availability-report__send" data-testid="report-send">
      {state.kind === 'idle' && <button type="button" onClick={onAsk}>{ta('Send by email', 'Per Mail senden')}</button>}
      {state.kind === 'confirm' && (
        <p>
          {ta('Send to', 'Senden an')}: <strong>{recipients.join(', ')}</strong>{' '}
          <button type="button" onClick={onConfirm}>{ta('Send now', 'Jetzt senden')}</button>{' '}
          <button type="button" onClick={onCancel}>{ta('Cancel', 'Abbrechen')}</button>
        </p>
      )}
      {state.kind === 'sending' && (
        <p>
          <button type="button" disabled>{ta('Send now', 'Jetzt senden')}</button>{' '}
          <button type="button" disabled>{ta('Cancel', 'Abbrechen')}</button>{' '}
          <span role="status">{ta('The dispatch is running, this can take a minute.', 'Der Versand läuft, das kann eine Minute dauern.')}</span>
        </p>
      )}
      {state.kind === 'done' && <p role="status">{state.message}</p>}
      {state.kind === 'done' && state.rejected && state.rejected.length > 0 && (
        <p role="alert" className="availability-report__send-error">
          {ta('The mail server rejected these recipients, they received nothing', 'Der Mailserver hat diese Empfänger abgelehnt, sie haben nichts erhalten')}: {state.rejected.join(', ')}
        </p>
      )}
      {state.kind === 'error' && <ErrorBox state={state} onResume={onResume} onRestart={onRestart} />}
      <p className="availability-report__muted">
        {ta(
          'If the dispatch breaks off, it can only be continued directly afterwards with "Send the rest", not after reloading the page.',
          'Bricht der Versand ab, lässt er sich nur direkt danach mit „Rest senden“ fortsetzen, nicht nach dem Neuladen der Seite.',
        )}
      </p>
    </div>
  )
}
