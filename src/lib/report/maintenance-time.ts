/**
 * Wartungszeit einer Wartung für den Bericht (Konzept 4.8): die tatsächliche Zeit, soweit erfasst, sonst die geplante.
 * Beginn ist die erste Aktualisierung „Läuft“, sonst der geplante Beginn. Ende ist die letzte Aktualisierung
 * „Abgeschlossen“, sonst das geplante Ende. „Abgeschlossen am“ allein zählt nicht: Bei der automatischen Umstellung
 * steht dort der Zeitpunkt des Lesens und nicht das Ende der Wartung.
 */
export type MaintenanceInput = {
  status: string
  scheduledStartAt: string
  scheduledEndAt?: string | null
  completedAt?: string | null
  cancelledAt?: string | null
  updates: Array<{ status: string; createdAt: string }>
  serviceIds: number[]
}

const time = (value: string | null | undefined): number | null => (value ? new Date(value).getTime() : null)

export function maintenanceWindow(maintenance: MaintenanceInput, now: number): { from: number; to: number } | null {
  if (maintenance.status === 'upcoming') return null

  const scheduledStart = time(maintenance.scheduledStartAt)
  if (scheduledStart === null) return null
  const started = maintenance.updates.filter((update) => update.status === 'in_progress').map((update) => time(update.createdAt) as number)
  const from = started.length > 0 ? Math.min(...started) : scheduledStart

  let to: number | null
  if (maintenance.status === 'cancelled') {
    const cancelledAt = time(maintenance.cancelledAt)
    if (cancelledAt === null) return null
    // Ohne Aktualisierung „Läuft“ gilt die Wartung als gestartet, wenn der geplante Beginn vor dem Abbruch lag
    if (started.length === 0 && scheduledStart >= cancelledAt) return null
    to = cancelledAt
  } else if (maintenance.status === 'in_progress') {
    to = now
  } else {
    const finished = maintenance.updates.filter((update) => update.status === 'completed').map((update) => time(update.createdAt) as number)
    to = finished.length > 0 ? Math.max(...finished) : (time(maintenance.scheduledEndAt) ?? time(maintenance.completedAt))
  }

  if (to === null || to <= from) return null
  return { from, to }
}
