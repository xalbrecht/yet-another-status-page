'use client'

import React from 'react'
import { useAdminText } from '@/lib/i18n/admin-client'
import type { ServiceState } from '@/lib/service-lifecycle'

/** Darstellung der Schnellwahl über der Dienstliste. `current` ist `null`, wenn kein Zustandsfilter gesetzt ist („Alle“). */
export function ServiceStateFilterView(props: { current: ServiceState | null; onChoose: (state: ServiceState | null) => void }) {
  const ta = useAdminText()
  const { current, onChoose } = props
  const options: Array<{ state: ServiceState | null; label: string }> = [
    { state: null, label: ta('All') },
    { state: 'active', label: ta('Active') },
    { state: 'ended', label: ta('Ended') },
    { state: 'not-started', label: ta('Not started yet') },
  ]
  return (
    <div className="service-state-filter" role="group" aria-label={ta('Operating period')} data-testid="service-state-filter">
      <span className="service-state-filter__label">{ta('Operating period')}</span>
      {options.map((option) => (
        <button
          key={option.state ?? 'all'}
          type="button"
          className={`service-state-filter__button${option.state === current ? ' service-state-filter__button--active' : ''}`}
          aria-pressed={option.state === current}
          data-state={option.state ?? 'all'}
          onClick={() => onChoose(option.state)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
