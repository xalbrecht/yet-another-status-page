'use client'

import React, { useState } from 'react'
import type { RebuildResult } from '@/lib/status-log-rebuild'
import type { ConversionResult } from '@/lib/maintenance-conversion'
import type { PreviewCheck } from '@/lib/preview-check'
import { useAdminText } from '@/lib/i18n/admin-client'
import { failureMessage, parseJsonBody } from '@/lib/response-body'
import { StatusLogView } from './StatusLogView'

/** Zustand und Aufrufe der Seite „Statusprotokoll pflegen“. Ausführen erst nach Vorschau und Bestätigung, die Umwandlung zusätzlich erst mit dem Haken zur Sicherung. */
export const StatusLogActions: React.FC<{ ruleCount: number; timeZone: string; locale: string }> = ({ ruleCount, timeZone, locale }) => {
  const ta = useAdminText()
  const [rebuild, setRebuild] = useState<RebuildResult | null>(null)
  const [conversion, setConversion] = useState<ConversionResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [backupConfirmed, setBackupConfirmed] = useState(false)

  /**
   * `expect`: beim Ausführen das Feld `check` der Vorschau. Der Server prüft damit, ob die Vorschau noch stimmt.
   * `onRejected`: bei einer abgelehnten Anfrage (zum Beispiel HTTP 409, Vorschau veraltet) die alte Vorschau verwerfen,
   * damit „Ausführen“ erst nach einer neuen Vorschau wieder bedienbar ist.
   */
  async function call<T>(path: string, dryRun: boolean, done: (result: T) => void, expect?: PreviewCheck, onRejected?: () => void) {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(path, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dryRun ? { dryRun } : { dryRun, expect }),
      })
      // Ein Proxy oder Server kann HTML statt JSON liefern: dann den HTTP-Status nennen, nicht „Unexpected token“
      const body = parseJsonBody(await response.text())
      if (!response.ok) {
        if (response.status === 409) onRejected?.()
        throw new Error(failureMessage(response.status, body, (status) => ta('The server answered with an error (HTTP {status}).').replace('{status}', String(status))))
      }
      if (body === null) throw new Error(ta('The answer of the server could not be read.'))
      done(body as T)
    } catch (err) {
      setError(err instanceof Error ? err.message : ta('Unknown error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <StatusLogView
      timeZone={timeZone}
      locale={locale}
      rebuild={rebuild}
      conversion={conversion}
      busy={busy}
      error={error}
      ruleCount={ruleCount}
      backupConfirmed={backupConfirmed}
      onBackupConfirmed={setBackupConfirmed}
      onPreviewRebuild={() => call<RebuildResult>('/api/status-log/rebuild', true, setRebuild)}
      onRunRebuild={() => {
        if (!window.confirm(ta('Replace the reconstructed entries now?'))) return
        void call<RebuildResult>('/api/status-log/rebuild', false, setRebuild, rebuild?.check, () => setRebuild(null))
      }}
      onPreviewConversion={() => call<ConversionResult>('/api/status-log/convert-maintenance', true, setConversion)}
      onRunConversion={() => {
        if (!window.confirm(ta('Convert these incidents into maintenances and delete the incidents? This cannot be undone. Did you create a backup?'))) return
        // Der Haken gilt für einen Lauf: nach dem Ausführen muss er neu gesetzt werden
        setBackupConfirmed(false)
        void call<ConversionResult>('/api/status-log/convert-maintenance', false, setConversion, conversion?.check, () => setConversion(null))
      }}
    />
  )
}
