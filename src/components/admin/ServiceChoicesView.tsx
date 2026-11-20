'use client'

import React from 'react'
import { useAdminText } from '@/lib/i18n/admin-client'
import type { RememberableStatus } from '@/lib/service-status-sync'

export type ServiceChoiceItem = { id: number | string; name: string; remembered: RememberableStatus; restore: boolean }

/** Darstellung der Auswahl je Dienst. Der Zustand liegt im Formular von Payload, siehe ServiceChoicesField. */
export const ServiceChoicesView: React.FC<{ items: ServiceChoiceItem[]; onChange: (id: number | string, restore: boolean) => void }> = ({
  items,
  onChange,
}) => {
  const ta = useAdminText()
  if (items.length === 0) return null
  const statusLabel: Record<RememberableStatus, string> = {
    operational: ta('Operational'),
    degraded: ta('Degraded Performance'),
    partial: ta('Partial Outage'),
    major: ta('Major Outage'),
  }
  return (
    <div className="service-choices" data-testid="service-choices">
      <h4 className="service-choices__title">{ta('Services after the resolution')}</h4>
      {items.map((item) => (
        <label key={String(item.id)} className="service-choices__choice" data-testid="service-choice">
          <input type="checkbox" checked={item.restore} onChange={(event) => onChange(item.id, event.target.checked)} />
          <span>
            <strong className="service-choices__name">{item.name}</strong>
            <span className="service-choices__text">
              {ta('Before the incident the service was in the status "{{status}}". Return to this status?').replace(
                '{{status}}',
                statusLabel[item.remembered],
              )}
            </span>
          </span>
        </label>
      ))}
      <p className="service-choices__hint">{ta('Without the tick the service is set to Operational.')}</p>
    </div>
  )
}
