import type { RememberableStatus, ServiceChoice } from '@/lib/service-status-sync'

export type ChoiceRow = { service: number | string; restore: boolean }

const idOf = (value: unknown): number | string | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'object') return (value as { id?: number | string }).id ?? null
  return value as number | string
}

/**
 * Zeilen des Feldes `serviceChoices` für die Behebung eines Vorfalls: je betroffenem Dienst mit gemerktem Zustand eine Zeile.
 * Eine bereits getroffene Wahl bleibt, neue Zeilen sind angehakt („Zurück“). Dienste ohne gemerkten Zustand und Dienste, die
 * nicht mehr zum Vorfall gehören, fallen weg.
 */
export function buildChoiceRows(
  affected: Array<unknown>,
  remembered: Record<string, RememberableStatus | null | undefined>,
  existing: ServiceChoice[],
): ChoiceRow[] {
  const known = new Map<string, boolean>()
  for (const row of existing) {
    const id = idOf(row.service)
    if (id !== null) known.set(String(id), row.restore !== false)
  }
  const rows: ChoiceRow[] = []
  const seen = new Set<string>()
  for (const entry of affected) {
    const id = idOf(entry)
    if (id === null || seen.has(String(id))) continue
    seen.add(String(id))
    if (!remembered[String(id)]) continue
    rows.push({ service: id, restore: known.get(String(id)) ?? true })
  }
  return rows
}

/**
 * Gilt die Auswahl in diesem Formular? Nur bei einer neuen Behebung: Die letzte Aktualisierung ist „Behoben“ und war es beim
 * Laden nicht (neue Zeile oder geänderter Status). Ein alter, behobener Vorfall, den man nur öffnet, bleibt unberührt, sonst
 * gälte das Formular als geändert und die gespeicherte Wahl ginge beim Speichern verloren.
 */
export function choicesApply(lastStatus: string | undefined, lastInitialStatus: string | undefined): boolean {
  return lastStatus === 'resolved' && lastInitialStatus !== 'resolved'
}

/** Dienste, die ein weiterer offener Vorfall erfasst, erhalten keine Zeile: Die Wahl wirkt erst beim Ende des letzten Vorfalls. */
export function withoutBlocked(
  remembered: Record<string, RememberableStatus | null | undefined>,
  blocked: Set<string>,
): Record<string, RememberableStatus | null | undefined> {
  return Object.fromEntries(Object.entries(remembered).map(([id, status]) => [id, blocked.has(id) ? null : status]))
}
