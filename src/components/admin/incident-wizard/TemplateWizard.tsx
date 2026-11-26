'use client'

import React, { useState } from 'react'
import { useAdminText } from '@/lib/i18n/admin-client'
import { IncidentWizard } from './IncidentWizard'
import { MaintenanceWizard } from './MaintenanceWizard'
import type { WizardGroup, WizardTemplate } from './IncidentWizardParts'
import type { WizardKind } from '@/lib/wizard-access'
import './incident-wizard.scss'

export type MessageKind = WizardKind

/**
 * Seite „Neu erstellen mit Vorlage“: Am Anfang die Wahl der Art (Störung oder Wartung), darunter der Ablauf der gewählten Art.
 * Ein Wechsel der Art beginnt den Ablauf von vorn, die Eingaben der anderen Art gehen verloren.
 * `kinds` nennt die Arten, die das Konto anlegen darf. Gibt es nur eine (Produktmanager: Wartung), entfällt die Wahl.
 * Für Wartungen gilt eine eigene Liste der Gruppen (`maintenanceGroups`), der Bereich einer Wartung kann größer sein als der einer Störung.
 */
export const TemplateWizard: React.FC<{
  kinds: MessageKind[]
  groups: WizardGroup[]
  maintenanceGroups: WizardGroup[]
  incidentTemplates: WizardTemplate[]
  maintenanceTemplates: WizardTemplate[]
  locale: string
  timeZone: string
  initialKind: MessageKind
}> = ({ kinds, groups, maintenanceGroups, incidentTemplates, maintenanceTemplates, locale, timeZone, initialKind }) => {
  const ta = useAdminText()
  const [kind, setKind] = useState<MessageKind>(initialKind)
  const options = ([
    ['incident', ta('Incident')],
    ['maintenance', ta('Maintenance')],
  ] as Array<[MessageKind, string]>).filter(([value]) => kinds.includes(value))
  return (
    <>
      {options.length > 1 && (
      <div className="iw" style={{ paddingBottom: 0 }}>
        <div className="iw-kind" role="radiogroup" aria-label={ta('Type')} data-testid="kind">
          <div className="iw-seg">
            {options.map(([value, label]) => (
              <label key={value} className={kind === value ? 'iw-sel' : ''}>
                <input type="radio" name="iw-kind" data-testid={`kind-${value}`} checked={kind === value} onChange={() => setKind(value)} />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>
      )}
      {kind === 'incident' ? (
        <IncidentWizard key="incident" groups={groups} templates={incidentTemplates} locale={locale} />
      ) : (
        <MaintenanceWizard
          key="maintenance"
          groups={maintenanceGroups.map((group) => ({ ...group, services: group.services.map((service) => ({ ...service, openIncident: false })) }))}
          templates={maintenanceTemplates}
          locale={locale}
          timeZone={timeZone}
        />
      )}
    </>
  )
}
