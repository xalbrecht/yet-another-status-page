import React from 'react'
import { useAdminText } from '@/lib/i18n/admin-client'

/**
 * Darstellung des Mailversands auf der Berichtsseite. Reine Komponente: der Zustand kommt von außen
 * (SendReportButton). Bei jedem Fehler erklärt sie den Grund und bietet nur die Schritte an, die möglich sind.
 */
export type SendState =
  | { kind: 'idle' }
  | { kind: 'confirm' }
  | { kind: 'sending' }
  | { kind: 'done'; message: string; rejected?: string[] }
  | { kind: 'error'; code: string; message: string; sent?: number; mails?: number; nextMail?: number; openPeriod?: boolean }

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
  const ta = useAdminText()
  const { state, onResume, onRestart } = props
  // Die Route zählt nur die Mails dieses Aufrufs. Gesendet ist alles vor der nächsten Mail, auch aus früheren Versuchen.
  const sent = state.nextMail !== undefined ? state.nextMail - 1 : state.sent ?? 0
  if (state.code === 'plan-changed') {
    return (
      <div role="alert" className="availability-report__send-error">
        <p>
          {state.openPeriod
            ? ta(
                'The dispatch cannot be continued: the period is still running, so the images differ with every attempt. The emails already sent belong to an earlier minute. Please restart the whole dispatch, or choose a finished period. The recipients then receive all emails again, recognizable by "Part i of n".',
              )
            : ta(
                'The dispatch cannot be continued: the data of the report changed since the first attempt (for example a new entry in the status log). The emails already sent belong to an older state. Please restart the whole dispatch. The recipients then receive all emails again, recognizable by "Part i of n".',
              )}
        </p>
        <button type="button" onClick={onRestart}>{ta('Send again from the start')}</button>
      </div>
    )
  }
  if (state.code === 'send-failed') {
    const resumable = (state.nextMail ?? 1) > 1 && state.mails !== undefined
    return (
      <div role="alert" className="availability-report__send-error">
        <p>
          {resumable
            ? `${sent} ${ta('of')} ${state.mails} ${ta('emails are out, email')} ${state.nextMail} ${ta('did not arrive')}: ${state.message}.`
            : `${ta('No email went out')}: ${state.message}.`}
        </p>
        {resumable ? (
          <button type="button" onClick={onResume}>{`${ta('Send the rest (from email')} ${state.nextMail} ${ta('of')} ${state.mails})`}</button>
        ) : (
          <button type="button" onClick={onRestart}>{ta('Send again')}</button>
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
          )}
        </p>
      </div>
    )
  }
  const text =
    state.code === 'running'
      ? ta('A dispatch is already running. Please wait until it is finished (about a minute) and reload the page.')
      : state.message
  return (
    <div role="alert" className="availability-report__send-error">
      <p>{text}</p>
    </div>
  )
}

export function SendReportForm(props: SendReportFormProps) {
  const ta = useAdminText()
  const { recipients, state, onAsk, onCancel, onConfirm, onResume, onRestart } = props
  const askRef = React.useRef<HTMLButtonElement>(null)
  const confirmRef = React.useRef<HTMLButtonElement>(null)
  const statusRef = React.useRef<HTMLDivElement>(null)
  const previousKind = React.useRef(state.kind)
  // Der Zustand tauscht die Knöpfe aus, der Fokus würde auf <body> fallen. Er folgt deshalb dem Zustand.
  React.useEffect(() => {
    if (previousKind.current === state.kind) return
    previousKind.current = state.kind
    if (state.kind === 'confirm') confirmRef.current?.focus()
    else if (state.kind === 'idle') askRef.current?.focus()
    else statusRef.current?.focus()
  }, [state.kind])
  if (recipients.length === 0) {
    return (
      <div className="availability-report__send" data-testid="report-send">
        <p className="availability-report__muted">
          {ta('No recipients entered.')} <a href={SETTINGS_HREF}>{ta('Open the email settings')}</a>
        </p>
      </div>
    )
  }
  return (
    <div className="availability-report__send" data-testid="report-send">
      {state.kind === 'idle' && <button ref={askRef} type="button" onClick={onAsk}>{ta('Send by email')}</button>}
      {state.kind === 'confirm' && (
        <p>
          {ta('Send to')}: <strong>{recipients.join(', ')}</strong>{' '}
          <button ref={confirmRef} type="button" onClick={onConfirm}>{ta('Send now')}</button>{' '}
          <button type="button" onClick={onCancel}>{ta('Cancel')}</button>
        </p>
      )}
      {/* Dauerhafter Live-Bereich: Meldungen, die erst später im DOM erscheinen, lesen Screenreader sonst nicht vor */}
      <div ref={statusRef} tabIndex={-1} aria-live="polite" data-testid="report-send-status">
        {state.kind === 'sending' && (
          <p>
            <button type="button" disabled>{ta('Send now')}</button>{' '}
            <button type="button" disabled>{ta('Cancel')}</button>{' '}
            <span role="status">{ta('The dispatch is running, this can take a minute.')}</span>
          </p>
        )}
        {state.kind === 'done' && <p role="status">{state.message}</p>}
        {state.kind === 'done' && state.rejected && state.rejected.length > 0 && (
          <p role="alert" className="availability-report__send-error">
            {ta('The mail server rejected these recipients, they received nothing')}: {state.rejected.join(', ')}
          </p>
        )}
        {state.kind === 'error' && <ErrorBox state={state} onResume={onResume} onRestart={onRestart} />}
      </div>
      <p className="availability-report__muted">
        {ta(
          'If the dispatch breaks off, it can only be continued directly afterwards with "Send the rest", not after reloading the page.',
        )}
      </p>
    </div>
  )
}
