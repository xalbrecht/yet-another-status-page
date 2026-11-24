import React from 'react'
import Link from 'next/link'
import { ta } from '@/lib/i18n/admin'
import { hasRole, type RoleUser } from '@/lib/roles'
import { isStatusLogMaintenanceDisabled } from '@/lib/status-log-maintenance'

/** Menüpunkt „Statusprotokoll pflegen“ unter den Navigationslinks des Admin. Nur für Admin. Bei `DISABLE_STATUS_LOG_MAINTENANCE=true` fehlt er. */
export const StatusLogNavLink: React.FC<{ user?: RoleUser }> = ({ user }) =>
  isStatusLogMaintenanceDisabled() || !hasRole(user, 'admin') ? null : (
    <Link className="nav__link" href="/admin/protokoll-pflege" style={{ display: 'block', padding: '4px 0' }}>
      {ta('Maintain the status log')}
    </Link>
  )
