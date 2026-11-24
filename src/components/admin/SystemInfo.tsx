'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import { useAdminText } from '@/lib/i18n/admin-client'
import { hasRole, type RoleUser } from '@/lib/roles'
import { summaryLine } from '@/lib/system-info'
import { formatter, SystemCardView, type SystemInfoResponse } from './SystemInfoView'
import './SystemInfo.scss'

/** Holt die Angaben einmal beim Anzeigen. Scheitert der Abruf, bleibt `failed` gesetzt und die Seite zeigt einen Hinweis statt eines Fehlers. */
function useSystemInfo(): { info: SystemInfoResponse | null; failed: boolean; allowed: boolean } {
  const { user } = useAuth()
  const allowed = hasRole(user as RoleUser, 'admin')
  const [info, setInfo] = useState<SystemInfoResponse | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    fetch('/api/system-info', { credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<SystemInfoResponse>
      })
      .then((data) => {
        if (!cancelled) setInfo(data)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [allowed])

  return { info, failed, allowed }
}

/** Karte „System“ auf dem Dashboard. */
export const SystemCard: React.FC = () => {
  const { info, failed, allowed } = useSystemInfo()
  if (!allowed) return null
  return <SystemCardView info={info} failed={failed} />
}

/** Eine Zeile im Fuß der Seitenleiste: Image-Tag und Build-Datum, ohne Image die Version. */
export const SystemNavLine: React.FC = () => {
  const ta = useAdminText()
  const { info } = useSystemInfo()
  if (!info) return null
  return (
    <div className="system-nav-line" data-testid="system-nav-line" title={ta('System')}>
      {summaryLine(info, formatter(info), ta)}
    </div>
  )
}
