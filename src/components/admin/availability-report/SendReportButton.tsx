'use client'

import React from 'react'
import { ta } from '@/lib/i18n/admin'
import { SendReportForm, type SendState } from './SendReportForm'

/**
 * Zustandsautomat des Mailversands: fragt vor dem Senden mit Empfängern nach, ruft die POST-Route auf und merkt sich
 * nach einem Abbruch Kennung, Zahl der Mails und die nächste Mail, damit „Rest senden“ fortsetzen kann.
 */
type Resume = { planId: string; nextMail: number }

export function SendReportButton(props: { recipients: string[]; query: string }) {
  const { recipients, query } = props
  const [state, setState] = React.useState<SendState>({ kind: 'idle' })
  const [resume, setResume] = React.useState<Resume | null>(null)

  async function run(from: Resume | null) {
    setState({ kind: 'sending' })
    try {
      const url = `/api/availability-report/send?${query}${from ? `&resume=${from.nextMail}&plan=${encodeURIComponent(from.planId)}` : ''}`
      const response = await fetch(url, { method: 'POST' })
      const body = (await response.json().catch(() => null)) as { error?: string; code?: string; sent?: number; mails?: number; planId?: string; nextMail?: number; recipients?: string[]; rejected?: string[] } | null
      if (response.ok && body) {
        setResume(null)
        setState({ kind: 'done', message: `${ta('Dispatch finished', 'Versand abgeschlossen')}: ${body.sent ?? 0} ${ta('emails to', 'Mails an')} ${(body.recipients ?? recipients).join(', ')}.`, rejected: body.rejected })
        return
      }
      // Ohne auswertbare Antwort (Zeitüberschreitung eines Proxys, Abbruch) ist offen, ob der Versand läuft oder fertig ist
      if (!body || !body.code) {
        setResume(null)
        setState({ kind: 'error', code: 'unknown-state', message: '' })
        return
      }
      setResume(body.code === 'send-failed' && body.planId && body.nextMail ? { planId: body.planId, nextMail: body.nextMail } : null)
      setState({ kind: 'error', code: body.code, message: body.error ?? ta('Unknown error', 'Unbekannter Fehler'), sent: body.sent, mails: body.mails, nextMail: body.nextMail })
    } catch {
      setResume(null)
      setState({ kind: 'error', code: 'unknown-state', message: '' })
    }
  }

  return (
    <SendReportForm
      recipients={recipients}
      state={state}
      onAsk={() => setState({ kind: 'confirm' })}
      onCancel={() => setState({ kind: 'idle' })}
      onConfirm={() => void run(null)}
      onResume={() => void run(resume)}
      onRestart={() => void run(null)}
    />
  )
}
