'use client'

import React, { useEffect, useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'
import { DEFAULT_DATETIME_CONFIG, formatDate, resolveDateTimeConfig, type DateTimeConfig } from '@/lib/datetime'
import { canDeleteService } from '@/lib/service-lifecycle'
import { ServiceDeleteNoticeView } from './ServiceDeleteNoticeView'
import './ServiceDeleteNotice.scss'

/** Feld im Formular eines Dienstes: nennt, wann der Dienst löschbar ist und was dabei entfällt. Für neue Dienste leer. */
export const ServiceDeleteNotice: React.FC = () => {
  const { id, initialData } = useDocumentInfo()
  const [entries, setEntries] = useState<number | null>(null)
  const [config, setConfig] = useState<DateTimeConfig>(DEFAULT_DATETIME_CONFIG)
  const [now] = useState(() => Date.now())

  useEffect(() => {
    if (!id) return
    let cancelled = false
    fetch('/api/globals/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setConfig(resolveDateTimeConfig(data))
      })
      .catch(() => {})
    fetch(`/api/service-status-events?where[service][equals]=${encodeURIComponent(String(id))}&limit=0`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setEntries(data.totalDocs ?? 0)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [id])

  if (!id) return null

  // Maßgeblich ist der gespeicherte Stand: Das Löschen prüft ebenfalls den gespeicherten Dienst, nicht das Formular.
  const saved = initialData as { startsAt?: string; endsAt?: string | null } | undefined
  const verdict = canDeleteService({ startsAt: saved?.startsAt ?? 0, endsAt: saved?.endsAt ?? null }, now)
  return (
    <ServiceDeleteNoticeView
      verdict={verdict.ok ? 'ended' : verdict.reason}
      entries={entries}
      endsAtLabel={saved?.endsAt ? formatDate(new Date(saved.endsAt), config) : ''}
    />
  )
}
