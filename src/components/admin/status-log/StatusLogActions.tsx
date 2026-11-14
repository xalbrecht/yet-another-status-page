'use client'

import React, { useState } from 'react'
import type { RebuildResult } from '@/lib/status-log-rebuild'
import type { ConversionResult } from '@/lib/maintenance-conversion'
import { useAdminText } from '@/lib/i18n/admin-client'
import { StatusLogView } from './StatusLogView'

/** Zustand und Aufrufe der Seite „Statusprotokoll pflegen“. Ausführen erst nach Vorschau und Bestätigung. */
export const StatusLogActions: React.FC = () => {
  const ta = useAdminText()
  const [rebuild, setRebuild] = useState<RebuildResult | null>(null)
  const [conversion, setConversion] = useState<ConversionResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function call<T>(path: string, dryRun: boolean, done: (result: T) => void) {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(path, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`)
      done(body as T)
    } catch (err) {
      setError(err instanceof Error ? err.message : ta('Unknown error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <StatusLogView
      rebuild={rebuild}
      conversion={conversion}
      busy={busy}
      error={error}
      onPreviewRebuild={() => call<RebuildResult>('/api/status-log/rebuild', true, setRebuild)}
      onRunRebuild={() => {
        if (!window.confirm(ta('Replace the reconstructed entries now?'))) return
        void call<RebuildResult>('/api/status-log/rebuild', false, setRebuild)
      }}
      onPreviewConversion={() => call<ConversionResult>('/api/status-log/convert-maintenance', true, setConversion)}
      onRunConversion={() => {
        if (!window.confirm(ta('Convert these incidents into maintenances and delete the incidents? This cannot be undone. Did you create a backup?'))) return
        void call<ConversionResult>('/api/status-log/convert-maintenance', false, setConversion)
      }}
    />
  )
}
