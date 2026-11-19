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
  affectsService: boolean
}

export type NoticeMaintenance = {
  status: string
  scheduledStartAt: string
  scheduledEndAt?: string | null
  serviceIds: string[]
  affectsService?: boolean
}

/** Laufende Wartung vor bevorstehender, innerhalb der Art zuerst die mit Auswirkung, dann die früheste. Abgeschlossene und abgesagte zählen nicht. */
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
    if (maintenance.status === 'in_progress') {
      candidates.push({ kind: 'running', start, end, affectsService: maintenance.affectsService === true })
    } else if (maintenance.status === 'upcoming' && start - now <= MAINTENANCE_NOTICE_LEAD_MS) {
      candidates.push({ kind: 'soon', start, end, affectsService: false })
    }
  }
  candidates.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'running' ? -1 : 1
    if (a.affectsService !== b.affectsService) return a.affectsService ? -1 : 1
    return a.start - b.start
  })
  return candidates[0] ?? null
}

/**
 * Zählt für die Wartungsleiste die Dienste in laufenden Wartungen. Ein Dienst zählt einmal, gilt in einer seiner
 * Wartungen die Auswirkung „ja“, zählt er als `limited`. Nur Dienste aus `serviceIds` (die angezeigten) zählen.
 */
export function countMaintenanceServices(
  maintenances: NoticeMaintenance[],
  serviceIds: string[],
): { unaffected: number; limited: number } {
  const shown = new Set(serviceIds)
  const limited = new Set<string>()
  const running = new Set<string>()
  for (const maintenance of maintenances) {
    if (maintenance.status !== 'in_progress') continue
    for (const id of maintenance.serviceIds) {
      if (!shown.has(id)) continue
      running.add(id)
      if (maintenance.affectsService === true) limited.add(id)
    }
  }
  return { unaffected: running.size - limited.size, limited: limited.size }
}
