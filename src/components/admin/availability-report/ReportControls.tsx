'use client'

import React from 'react'
import { ReportControlsForm, shouldSubmitOnChange, type ReportControlsFormProps } from './ReportControlsForm'

/** Client-Hülle: Jede Änderung einer Auswahl sendet das Formular ab, die Adresse trägt dann die neue Auswahl. */
export const ReportControls: React.FC<Omit<ReportControlsFormProps, 'onChange'>> = (props) => (
  <ReportControlsForm
    {...props}
    onChange={(event) => {
      const target = event.target as HTMLInputElement | HTMLSelectElement
      if (shouldSubmitOnChange({ type: target.type, name: target.name, value: target.value })) event.currentTarget.requestSubmit()
    }}
  />
)
