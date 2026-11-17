import React from 'react'

/**
 * Optionsfeld für „Aktiv im Berichtszeitraum“ und „Aktiv heute“: grün gefüllt mit Haken für ja, leerer Ring für nein.
 * Die Füllung trägt die Aussage, nicht nur die Farbe.
 */
export function ActiveMark(props: { active: boolean; label: string }) {
  const { active, label } = props
  return (
    <span
      className={`availability-report__opt availability-report__opt--${active ? 'yes' : 'no'}`}
      role="img"
      aria-label={label}
      data-active={String(active)}
    >
      {active ? '✓' : ''}
    </span>
  )
}
