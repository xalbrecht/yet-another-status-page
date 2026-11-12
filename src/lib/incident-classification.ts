/**
 * Einordnung eines Vorfalls für die Nachrechnung des Verlaufs (Konzept 5.1).
 * Reine Funktionen ohne Datenbankzugriff. Das Feld `impact` der Vorfälle bleibt unberücksichtigt.
 */

export type IncidentClass = {
  status: 'maintenance' | 'none' | 'degraded' | 'major' | 'partial'
  /** `false`: kein klares Merkmal, als Teilausfall gewertet */
  sure: boolean
}

// „Leistungsniveau“ steht in der Vorlage jeder Erstmeldung und zählt deshalb nicht
const PERFORMANCE_WORDS = /performance|ladezeit|wartezeit|langsam|verzögerung|verzögert/i

/** Ordnet einen Vorfall nach Titel und Text der Aktualisierungen ein. Die Regeln gelten in dieser Reihenfolge. */
export function classifyIncident(input: { title: string; messages: string[] }): IncidentClass {
  const title = input.title.trim().toLowerCase()
  if (title.includes('wartung')) return { status: 'maintenance', sure: true }
  if (title.startsWith('hinweis')) return { status: 'none', sure: true }
  if (PERFORMANCE_WORDS.test(input.messages.join(' '))) return { status: 'degraded', sure: true }
  if (title.startsWith('vollständiger serviceausfall')) return { status: 'major', sure: true }
  if (title.startsWith('teilweiser ausfall')) return { status: 'partial', sure: true }
  return { status: 'partial', sure: false }
}

/** Zahlen für die Fußnoten des Berichts: nicht eindeutig eingeordnete Vorfälle und Vorfälle ohne Dienst. */
export function summarizeClassification(
  incidents: Array<{ title: string; messages: string[]; serviceCount: number }>,
): { unsure: number; withoutService: number } {
  let unsure = 0
  let withoutService = 0
  for (const incident of incidents) {
    if (!classifyIncident(incident).sure) unsure++
    if (incident.serviceCount === 0) withoutService++
  }
  return { unsure, withoutService }
}
