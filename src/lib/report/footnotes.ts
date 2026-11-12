import { classifyIncident } from '@/lib/incident-classification'

/**
 * Zahlen für die Fußnoten des Berichts (Konzept 5.2): Vorfälle vor dem ersten Betriebseintrag im angezeigten Bereich,
 * die nicht eindeutig eingeordnet sind, und Vorfälle ohne Dienst. Der Bereich ist der ganze angezeigte Verlauf.
 * Bei gewählter Gruppe zählen nur Vorfälle mit einem Dienst der Gruppe, Vorfälle ohne Dienst nicht.
 */
export type FootnoteIncident = {
  title: string
  messages: string[]
  availabilityClass?: string | null
  createdAt: number
  /** `null`: offen */
  resolvedAt: number | null
  serviceIds: number[]
}

export function countFootnotes(
  incidents: FootnoteIncident[],
  options: { rangeStart: number; rangeEnd: number; firstOperationAt: number | null; groupServiceIds: number[] | null },
): { unsure: number; withoutService: number } {
  let unsure = 0
  let withoutService = 0
  for (const incident of incidents) {
    const to = incident.resolvedAt ?? Number.POSITIVE_INFINITY
    if (options.firstOperationAt !== null && incident.createdAt >= options.firstOperationAt) continue
    if (incident.createdAt >= options.rangeEnd || to <= options.rangeStart) continue
    if (incident.serviceIds.length === 0) {
      if (!options.groupServiceIds) withoutService++
      continue
    }
    if (options.groupServiceIds && !incident.serviceIds.some((id) => options.groupServiceIds?.includes(id))) continue
    if (!classifyIncident({ title: incident.title, messages: incident.messages, availabilityClass: incident.availabilityClass }).sure) unsure++
  }
  return { unsure, withoutService }
}
