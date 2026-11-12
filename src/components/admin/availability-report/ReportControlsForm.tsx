import React from 'react'
import { ta } from '@/lib/i18n/admin'
import { TOP_N_MAX, TOP_N_MIN, type ReportParams } from '@/lib/report/params'

/**
 * Auswahlfelder der Berichtsseite. Ein normales GET-Formular: Es funktioniert auch ohne Skript, und die Auswahl steht in
 * der Adresse. Die Client-Hülle (ReportControls) sendet das Formular bei jeder Änderung ab.
 */
export type ReportControlsFormProps = {
  params: ReportParams
  periodKey: string
  periodOptions: Array<{ value: string; label: string }>
  onChange?: React.FormEventHandler<HTMLFormElement>
}

/**
 * Soll eine Änderung das Formular absenden? Nicht bei Datumsfeldern (die Eingabe ist erst mit „Anwenden“ vollständig)
 * und nicht bei der Wahl „Freier Zeitraum“ (erst Daten eintragen).
 */
export function shouldSubmitOnChange(target: { type: string; name: string; value: string }): boolean {
  if (target.type === 'date') return false
  if (target.name === 'period' && target.value === 'custom') return false
  return true
}

const TOP_N_VALUES = Array.from({ length: TOP_N_MAX - TOP_N_MIN + 1 }, (_, index) => TOP_N_MIN + index)

export function ReportControlsForm({ params, periodKey, periodOptions, onChange }: ReportControlsFormProps) {
  return (
    <form method="get" className="availability-report__controls" onChange={onChange}>
      <input type="hidden" name="view" value={params.view} />
      {params.view === 'groups' && params.group && <input type="hidden" name="group" value={params.group} />}
      <label>
        {ta('Period', 'Zeitraum')}
        <select name="period" defaultValue={periodKey}>
          {periodOptions.map((option) => (
            <option key={option.value} value={option.value} selected={option.value === periodKey}>{option.value === 'custom' ? ta('Custom period', 'Freier Zeitraum') : option.label}</option>
          ))}
        </select>
      </label>
      <label>
        {ta('From (custom period)', 'Von (freier Zeitraum)')}
        <input type="date" name="from" defaultValue={params.from ?? ''} />
      </label>
      <label>
        {ta('To (custom period)', 'Bis (freier Zeitraum)')}
        <input type="date" name="to" defaultValue={params.to ?? ''} />
      </label>
      <label>
        {ta('Calculation', 'Rechenart')}
        <select name="calc" defaultValue={params.calc}>
          <option value="whole" selected={params.calc === 'whole'}>{ta('One value for the period', 'Ein Wert für den Zeitraum')}</option>
          <option value="monthly" selected={params.calc === 'monthly'}>{ta('Mean of the monthly values', 'Mittel der Monatswerte')}</option>
        </select>
      </label>
      <label>
        {ta('Maintenance', 'Wartung')}
        <select name="maintenance" defaultValue={params.maintenance}>
          <option value="A" selected={params.maintenance === 'A'}>{ta('A: counts as available', 'A: zählt als verfügbar')}</option>
          <option value="B" selected={params.maintenance === 'B'}>{ta('B: counts as outage', 'B: zählt als Ausfall')}</option>
          <option value="C" selected={params.maintenance === 'C'}>{ta('C: excluded from the total time', 'C: aus der Gesamtzeit herausgenommen')}</option>
        </select>
      </label>
      <label>
        {ta('Weakest services', 'Schwächste Dienste')}
        <select name="topN" defaultValue={String(params.topN)}>
          {TOP_N_VALUES.map((value) => (
            <option key={value} value={String(value)} selected={value === params.topN}>{value}</option>
          ))}
        </select>
      </label>
      <label className="availability-report__check">
        <input type="checkbox" name="showMaintenance" value="true" defaultChecked={params.showMaintenance} />
        {ta('Show maintenance time', 'Wartungszeit anzeigen')}
        <input type="hidden" name="showMaintenance" value="false" />
      </label>
      <button type="submit">{ta('Apply', 'Anwenden')}</button>
    </form>
  )
}
