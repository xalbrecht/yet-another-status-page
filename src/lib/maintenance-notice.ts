/**
 * Wartung am Dienst: welche Wartung die Statusseite neben dem Zustand eines Dienstes anzeigt.
 * Reine Funktion. Die Anzeige kommt aus den erfassten Wartungen, nicht aus dem Zustand „Wartung“ am Dienst.
 */

/** Eine bevorstehende Wartung erscheint ab dieser Zeit vor ihrem Beginn. */
export const MAINTENANCE_NOTICE_LEAD_MS = 24 * 3600_000

export type MaintenanceNotice = {
  /** `running`: Wartung läuft, `soon`: beginnt in den nächsten 24 Stunden */
  kind: 'running' | 'soon'
  start: number
  /** `null`: kein Ende geplant */
  end: number | null
}

export type NoticeMaintenance = {
  status: string
  scheduledStartAt: string
  scheduledEndAt?: string | null
  serviceIds: string[]
}

/** Laufende Wartung vor bevorstehender, innerhalb der Art die früheste. Abgeschlossene und abgesagte zählen nicht. */
export function maintenanceNoticeFor(
  maintenances: NoticeMaintenance[],
  serviceId: string,
  now: number,
): MaintenanceNotice | null {
  const candidates: MaintenanceNotice[] = []
  for (const maintenance of maintenances) {
    if (!maintenance.serviceIds.includes(serviceId)) continue
    const start = new Date(maintenance.scheduledStartAt).getTime()
    const end = maintenance.scheduledEndAt ? new Date(maintenance.scheduledEndAt).getTime() : null
    if (maintenance.status === 'in_progress') candidates.push({ kind: 'running', start, end })
    else if (maintenance.status === 'upcoming' && start - now <= MAINTENANCE_NOTICE_LEAD_MS) {
      candidates.push({ kind: 'soon', start, end })
    }
  }
  candidates.sort((a, b) => (a.kind === b.kind ? a.start - b.start : a.kind === 'running' ? -1 : 1))
  return candidates[0] ?? null
}
