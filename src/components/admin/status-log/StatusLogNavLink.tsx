import React from 'react'
import Link from 'next/link'
import { ta } from '@/lib/i18n/admin'
import { isStatusLogMaintenanceDisabled } from '@/lib/status-log-maintenance'

/** Menüpunkt „Statusprotokoll pflegen“ unter den Navigationslinks des Admin. Bei `DISABLE_STATUS_LOG_MAINTENANCE=true` fehlt er. */
export const StatusLogNavLink: React.FC = () =>
  isStatusLogMaintenanceDisabled() ? null : (
    <Link className="nav__link" href="/admin/protokoll-pflege" style={{ display: 'block', padding: '4px 0' }}>
      {ta('Maintain the status log')}
    </Link>
  )
