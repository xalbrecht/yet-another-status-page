import { worstStatus, type AvailabilityStatus } from '@/lib/availability'

/**
 * Nachrechnung des Verlaufs je Dienst aus Vorfällen (Konzept 5). Reine Funktion ohne Datenbankzugriff.
 * Jeder Dienst bekommt am Anker den Zustand „Betriebsbereit“. Danach gilt je Zeitpunkt der schlechteste Zustand
 * der laufenden Vorfälle. Es entsteht nur ein Eintrag, wenn sich der Zustand ändert. Einträge ab dem ersten
 * Betriebseintrag des Dienstes entfallen, dort gilt der echte Zustand.
 */
export type ReconstructedEvent = { serviceId: number; at: number; status: AvailabilityStatus }

export function buildReconstructedEvents(input: {
  anchorAt: number
  services: Array<{ id: number; firstEventAt: number | null }>
  incidents: Array<{
    serviceIds: number[]
    from: number
    to: number
    status: Exclude<AvailabilityStatus, 'operational'>
  }>
}): ReconstructedEvent[] {
  const result: ReconstructedEvent[] = []
  for (const service of input.services) {
    const intervals = input.incidents
      .filter((incident) => incident.to > incident.from && incident.serviceIds.includes(service.id))
      .map((incident) => ({ from: incident.from, to: incident.to, status: incident.status }))
    const boundaries = Array.from(new Set(intervals.flatMap((interval) => [interval.from, interval.to]))).sort((a, b) => a - b)

    const events: Array<{ at: number; status: AvailabilityStatus }> = [{ at: input.anchorAt, status: 'operational' }]
    for (const at of boundaries) {
      const active = intervals.filter((interval) => interval.from <= at && at < interval.to)
      const status = worstStatus(active.map((interval) => interval.status)) ?? 'operational'
      const last = events[events.length - 1]
      if (last.at === at) last.status = status
      else if (last.status !== status) events.push({ at, status })
    }
    for (const event of events) {
      if (service.firstEventAt !== null && event.at >= service.firstEventAt) continue
      result.push({ serviceId: service.id, ...event })
    }
  }
  return result
}
