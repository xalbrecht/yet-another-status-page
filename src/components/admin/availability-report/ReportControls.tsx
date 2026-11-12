'use client'

import React from 'react'
import { ReportControlsForm, type ReportControlsFormProps } from './ReportControlsForm'

/** Client-Hülle: Jede Änderung einer Auswahl sendet das Formular ab, die Adresse trägt dann die neue Auswahl. */
export const ReportControls: React.FC<Omit<ReportControlsFormProps, 'onChange'>> = (props) => (
  <ReportControlsForm {...props} onChange={(event) => event.currentTarget.requestSubmit()} />
)
