/**
 * Gruppenwahl eines Abonnenten bei Anmeldung und Änderung: „alle Dienstgruppen“ oder eine Auswahl von Dienstgruppen.
 */
export type GroupChoice = { ok: true; allGroups: boolean; groups: number[] } | { ok: false; error: 'api.invalidGroups' }

/**
 * Liest `allGroups` und `groups` aus einer Anfrage. Ohne Angabe gilt „alle Dienstgruppen“, mit dem Haken wird eine
 * mitgesendete Auswahl ignoriert. Ohne den Haken zählt nur eine nicht leere Liste bekannter Gruppen (`knownGroupIds`),
 * doppelte Einträge entfallen. Alles andere (andere Typen, unbekannte oder leere Auswahl) ist ungültig.
 */
export function parseGroupChoice(body: unknown, knownGroupIds: number[]): GroupChoice {
  const invalid = { ok: false, error: 'api.invalidGroups' } as const
  const { allGroups, groups } = (body && typeof body === 'object' ? body : {}) as { allGroups?: unknown; groups?: unknown }

  if (allGroups === undefined || allGroups === true) return { ok: true, allGroups: true, groups: [] }
  if (allGroups !== false) return invalid
  if (!Array.isArray(groups) || groups.length === 0) return invalid

  const known = new Set(knownGroupIds)
  const chosen = new Set<number>()
  for (const id of groups) {
    if (typeof id !== 'number' || !Number.isInteger(id) || !known.has(id)) return invalid
    chosen.add(id)
  }
  return { ok: true, allGroups: false, groups: [...chosen] }
}
