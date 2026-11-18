/**
 * Zeitplan einer Wartung: Welcher Status gilt jetzt nach Beginn und Ende? Reine Funktionen, ohne Datenbank.
 * Gemeinsam genutzt vom Lesen und Schreiben der Collection und vom Zeitgeber, der fällige Wartungen umstellt.
 */

export type MaintenanceStatus = 'upcoming' | 'in_progress' | 'completed' | 'cancelled'

// Erlaubte Übergänge der automatischen Umstellung
const validTransitions: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  upcoming: ['in_progress', 'completed'],
  in_progress: ['completed'],
  completed: [], // Endzustand
  cancelled: [], // Endzustand
}

export function canTransition(from: MaintenanceStatus, to: MaintenanceStatus): boolean {
  return validTransitions[from]?.includes(to) ?? false
}

export interface ScheduleFields {
  status?: MaintenanceStatus | string | null
  scheduledStartAt?: string | null
  scheduledEndAt?: string | null
  autoStartOnSchedule?: boolean | null
  autoCompleteOnSchedule?: boolean | null
}

/** Der Status, den der Zeitplan jetzt vorgibt, oder `null`, wenn kein Übergang gilt. Das Ende hat Vorrang vor dem Beginn. */
export function resolveScheduledStatus(doc: ScheduleFields, now: Date = new Date()): MaintenanceStatus | null {
  const current = doc.status as MaintenanceStatus
  const startTime = doc.scheduledStartAt ? new Date(doc.scheduledStartAt) : null
  const endTime = doc.scheduledEndAt ? new Date(doc.scheduledEndAt) : null

  if (doc.autoCompleteOnSchedule && endTime && now >= endTime && canTransition(current, 'completed')) {
    return 'completed'
  }
  if (doc.autoStartOnSchedule && startTime && now >= startTime && canTransition(current, 'in_progress')) {
    return 'in_progress'
  }
  return null
}
