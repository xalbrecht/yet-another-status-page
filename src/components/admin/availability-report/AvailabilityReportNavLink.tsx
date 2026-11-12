import React from 'react'
import Link from 'next/link'
import { ta } from '@/lib/i18n/admin'

/** Menüpunkt „Verfügbarkeitsbericht“ unter den Navigationslinks des Admin. */
export const AvailabilityReportNavLink: React.FC = () => (
  <Link className="nav__link" href="/admin/verfuegbarkeitsbericht" style={{ display: 'block', padding: '4px 0' }}>
    {ta('Availability report', 'Verfügbarkeitsbericht')}
  </Link>
)
