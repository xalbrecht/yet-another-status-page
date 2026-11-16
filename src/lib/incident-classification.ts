/**
 * Einordnung eines Vorfalls für die Nachrechnung des Verlaufs vor dem Statusprotokoll.
 * Reine Funktionen ohne Datenbankzugriff. Das Feld `impact` der Vorfälle bleibt unberücksichtigt.
 * Die Regeln stehen in den Einstellungen (`classificationRules`), der Code kennt keine Wörter.
 */

export type IncidentClass = {
  status: 'maintenance' | 'none' | 'degraded' | 'major' | 'partial'
  /** `false`: keine Regel passt, als Teilausfall gewertet */
  sure: boolean
}

export const RULE_FIELDS = ['title', 'updates'] as const
export const RULE_MATCHES = ['contains', 'starts'] as const
export const RULE_CLASSIFICATIONS = ['maintenance', 'none', 'degraded', 'partial', 'major'] as const

export type ClassificationRule = {
  /** Wo gesucht wird: im Titel oder im Text aller Aktualisierungen */
  field: (typeof RULE_FIELDS)[number]
  match: (typeof RULE_MATCHES)[number]
  /** Wörter oder Wortfolgen, durch Komma getrennt. Eines davon genügt */
  words: string
  classification: (typeof RULE_CLASSIFICATIONS)[number]
}

const MANUAL_CLASSES = ['none', 'degraded', 'partial', 'major'] as const

const wordsOf = (words: string): string[] =>
  words
    .split(',')
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean)

/** Macht aus dem Wert der Einstellungen eine Regelliste. Zeilen mit unbekannten Werten oder ohne Wort entfallen. */
export function normalizeRules(raw: unknown): ClassificationRule[] {
  if (!Array.isArray(raw)) return []
  const rules: ClassificationRule[] = []
  for (const row of raw) {
    if (typeof row !== 'object' || row === null) continue
    const { field, match, words, classification } = row as Record<string, unknown>
    if (!(RULE_FIELDS as readonly unknown[]).includes(field)) continue
    if (!(RULE_MATCHES as readonly unknown[]).includes(match)) continue
    if (!(RULE_CLASSIFICATIONS as readonly unknown[]).includes(classification)) continue
    if (typeof words !== 'string' || wordsOf(words).length === 0) continue
    rules.push({ field, match, words, classification } as ClassificationRule)
  }
  return rules
}

/**
 * Ordnet einen Vorfall ein. Eine Einordnung von Hand (`availabilityClass` ungleich `auto`) gilt immer und zählt als
 * eindeutig. Sonst gelten die Regeln in ihrer Reihenfolge, die erste passende entscheidet. Groß- und Kleinschreibung
 * zählt nicht. Passt keine Regel (oder gibt es keine), ist es ein nicht eindeutiger Teilausfall.
 */
export function classifyIncident(
  input: { title: string; messages: string[]; availabilityClass?: string | null },
  rules: readonly ClassificationRule[] = [],
): IncidentClass {
  const manual = (MANUAL_CLASSES as readonly string[]).includes(input.availabilityClass ?? '')
    ? (input.availabilityClass as (typeof MANUAL_CLASSES)[number])
    : null
  if (manual) return { status: manual, sure: true }
  const title = input.title.trim().toLowerCase()
  const updates = input.messages.join(' ').trim().toLowerCase()
  for (const rule of rules) {
    const text = rule.field === 'title' ? title : updates
    const hit = wordsOf(rule.words).some((word) => (rule.match === 'starts' ? text.startsWith(word) : text.includes(word)))
    if (hit) return { status: rule.classification, sure: true }
  }
  return { status: 'partial', sure: false }
}

/** Zahlen für die Fußnoten des Berichts: nicht eindeutig eingeordnete Vorfälle und Vorfälle ohne Dienst. */
export function summarizeClassification(
  incidents: Array<{ title: string; messages: string[]; serviceCount: number; availabilityClass?: string | null }>,
  rules: readonly ClassificationRule[] = [],
): { unsure: number; withoutService: number } {
  let unsure = 0
  let withoutService = 0
  for (const incident of incidents) {
    if (!classifyIncident(incident, rules).sure) unsure++
    if (incident.serviceCount === 0) withoutService++
  }
  return { unsure, withoutService }
}
