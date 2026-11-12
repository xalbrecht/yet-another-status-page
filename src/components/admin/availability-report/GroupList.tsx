import React from 'react'
import { formatAvailability } from '@/lib/availability'
import type { GroupListEntry } from '@/lib/report/aggregate'

/** Liste aller Gruppen, schwächste zuerst, mit Farbpunkt (Stufe der Wärmekarte) und Verfügbarkeit. Jede Zeile ist ein Link. */
export function GroupList(props: { groups: GroupListEntry[]; selectedId: number | null; hrefFor: (id: number) => string; locale: string }) {
  const { groups, selectedId, hrefFor, locale } = props
  return (
    <ul className="availability-report__groups" data-testid="group-list">
      {groups.map((group) => (
        <li key={group.id}>
          <a href={hrefFor(group.id)} aria-current={group.id === selectedId ? 'true' : undefined}>
            <i className={`availability-report__dot-level heat-${group.level}`} />
            <span className="availability-report__group-name">{group.name}</span>
            <span className="availability-report__group-value">{group.availability === null ? '–' : formatAvailability(group.availability, locale)}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}
