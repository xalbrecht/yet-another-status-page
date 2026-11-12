import React from 'react'
import { ta } from '@/lib/i18n/admin'

/** Zwei Ansichten der Berichtsseite als Links: Gesamtbericht und Gruppenberichte. Die Adressen enthalten die Auswahl. */
export function ViewTabs(props: { active: 'overall' | 'groups'; hrefs: { overall: string; groups: string } }) {
  const { active, hrefs } = props
  return (
    <nav className="availability-report__tabs" aria-label={ta('Report views', 'Berichtsansichten')}>
      <a href={hrefs.overall} aria-current={active === 'overall' ? 'page' : undefined}>{ta('Overall report', 'Gesamtbericht')}</a>
      <a href={hrefs.groups} aria-current={active === 'groups' ? 'page' : undefined}>{ta('Group reports', 'Gruppenberichte')}</a>
    </nav>
  )
}
