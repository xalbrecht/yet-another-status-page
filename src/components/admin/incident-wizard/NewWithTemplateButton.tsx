'use client'

import React from 'react'
import Link from 'next/link'
import { useAuth } from '@payloadcms/ui'
import { useAdminText } from '@/lib/i18n/admin-client'
import type { RoleUser } from '@/lib/roles'
import { wizardAccess } from '@/lib/wizard-access'
import './incident-wizard.scss'

/**
 * Knopf „Neu erstellen mit Vorlage“ im Kopfbereich der Liste „Störungen“, unter dem Titel (Platz „Description“ der Collection).
 * Konten ohne Recht, Störungen anzulegen (Produktmanager), sehen ihn nicht.
 */
export const NewWithTemplateButton: React.FC = () => {
  const ta = useAdminText()
  const { user } = useAuth()
  if (user && !wizardAccess(user as RoleUser).kinds.includes('incident')) return null
  return (
    <div className="iw-list-action">
      <Link className="btn btn--icon-style-without-border btn--size-small btn--withoutPopup btn--style-pill" href="/admin/incident-from-template" data-testid="new-with-template" style={{ textDecoration: 'none' }}>
        <span className="btn__content"><span className="btn__label">{ta('Create new with template')}</span></span>
      </Link>
    </div>
  )
}

/** Wie `NewWithTemplateButton`, für die Liste „Wartungen“: Die Seite öffnet mit der Art „Wartung“. */
export const NewMaintenanceWithTemplateButton: React.FC = () => {
  const ta = useAdminText()
  return (
    <div className="iw-list-action">
      <Link className="btn btn--icon-style-without-border btn--size-small btn--withoutPopup btn--style-pill" href="/admin/incident-from-template?kind=maintenance" data-testid="new-maintenance-with-template" style={{ textDecoration: 'none' }}>
        <span className="btn__content"><span className="btn__label">{ta('Create new with template')}</span></span>
      </Link>
    </div>
  )
}
