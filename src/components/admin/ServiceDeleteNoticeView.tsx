'use client'

import React from 'react'
import { useAdminText } from '@/lib/i18n/admin-client'

export type DeleteVerdict = 'active' | 'ends-in-future' | 'ended'

/** Darstellung des Hinweises. `entries` ist `null`, solange die Zahl der Einträge nicht geladen ist. */
export function ServiceDeleteNoticeView(props: { verdict: DeleteVerdict; entries: number | null; endsAtLabel: string }) {
  const ta = useAdminText()
  const { verdict, entries, endsAtLabel } = props

  if (verdict === 'active') {
    return (
      <div className="service-delete-notice service-delete-notice--info" role="note">
        <strong>{ta('This service is active.')}</strong>{' '}
        {ta('It can only be deleted once an end date is set and reached. Until then it stays available in the availability report.')}
      </div>
    )
  }

  if (verdict === 'ends-in-future') {
    return (
      <div className="service-delete-notice service-delete-notice--info" role="note">
        <strong>{ta('The end is still in the future.')}</strong>{' '}
        {ta('The service stays active up to and including {{date}}. After that it can be deleted.').replace('{{date}}', endsAtLabel)}
      </div>
    )
  }

  const count =
    entries === null
      ? ''
      : entries === 1
        ? ta('This service and its 1 status log entry will be deleted.')
        : ta('This service and its {{count}} status log entries will be deleted.').replace('{{count}}', String(entries))

  return (
    <div className="service-delete-notice service-delete-notice--warn" role="note">
      <strong>{ta('Deleting removes the status log.')}</strong> {count}{' '}
      {ta('The situation overview and the report no longer include the service afterwards, not even for past periods. The service is then also removed from the availability report. As long as it is only ended, it can still be evaluated in the report with the switch "Include ended services".')}
    </div>
  )
}
