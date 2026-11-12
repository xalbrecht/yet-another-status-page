import React from 'react'
import Link from 'next/link'
import { ta } from '@/lib/i18n/admin'

/** Menüpunkt „Statusprotokoll pflegen“ unter den Navigationslinks des Admin. */
export const StatusLogNavLink: React.FC = () => (
  <Link className="nav__link" href="/admin/protokoll-pflege" style={{ display: 'block', padding: '4px 0' }}>
    {ta('Maintain the status log', 'Statusprotokoll pflegen')}
  </Link>
)
