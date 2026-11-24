import React from 'react'
import Link from 'next/link'
import { ta } from '@/lib/i18n/admin'
import { hasAnyRole, type RoleUser } from '@/lib/roles'

/** Menüpunkt „Verfügbarkeitsbericht“ unter den Navigationslinks des Admin, nur für Admin und Produktmanager. */
export const AvailabilityReportNavLink: React.FC<{ user?: RoleUser }> = ({ user }) =>
  !hasAnyRole(user, ['admin', 'produktmanager']) ? null : (
  <Link className="nav__link" href="/admin/verfuegbarkeitsbericht" style={{ display: 'block', padding: '4px 0' }}>
    {ta('Availability report')}
  </Link>
  )
