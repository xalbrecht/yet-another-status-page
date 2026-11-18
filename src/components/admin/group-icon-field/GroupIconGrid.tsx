import React from 'react'
import { GroupIcon } from '@/components/status/lagebild/GroupIcon'
import { selectedIconIndex } from '@/lib/icon-picker'

export type IconOption = { label: string; value: string }

/**
 * Raster aller Symbole einer Dienstgruppe mit Namen. Reine Darstellung ohne Zustand: Wert und Auswahl kommen von außen. Gruppe von
 * Optionsfeldern (`radiogroup`), das gewählte Symbol ist markiert und per Tab erreichbar, die Pfeiltasten wechseln (Behandlung in
 * `GroupIconField.tsx`).
 */
export function GroupIconGrid({
  options,
  value,
  disabled,
  label,
  onSelect,
  onKeyDown,
  setButtonRef,
}: {
  options: readonly IconOption[]
  value: string | null | undefined
  disabled?: boolean
  label: string
  onSelect: (value: string) => void
  onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => void
  setButtonRef?: (index: number, element: HTMLButtonElement | null) => void
}) {
  const focusIndex = selectedIconIndex(options.map((option) => option.value), value)
  return (
    <div className="group-icon-grid" role="radiogroup" aria-label={label} data-testid="group-icon-grid">
      {options.map((option, index) => {
        const checked = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={index === focusIndex ? 0 : -1}
            disabled={disabled}
            title={option.label}
            data-testid={`group-icon-${option.value}`}
            className={`group-icon-grid__tile${checked ? ' group-icon-grid__tile--on' : ''}`}
            ref={(element) => setButtonRef?.(index, element)}
            onClick={() => onSelect(option.value)}
            onKeyDown={(event) => onKeyDown?.(event, index)}
          >
            <GroupIcon name={option.value} className="group-icon-grid__icon" />
            <span className="group-icon-grid__label">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
