import { statusAt, type Timeline } from '@/lib/availability'
import type { MaintenanceKind } from '@/lib/maintenance-kind'

/**
 * Kennzahlen eines Dienstes in einem Zeitraum. Reine Funktion.
 * Der Zeitraum wird an den Einträgen der Zeitleiste und den Wartungsfenstern in Abschnitte geteilt.
 * „In Wartung“ gilt nur für die Wartungsfenster. Der Zustand `maintenance` im Protokoll zählt wie `operational`.
 *
 * Wartungsart A: Wartung zählt als verfügbar, Störungen in der Wartung zählen nicht.
 * Wartungsart B: Wartung zählt als Ausfall.
 * Wartungsart C: Wartung ist aus der Gesamtzeit herausgenommen.
 *
 * Die Rechenart gilt je Art der Wartung (im Wartungsfenster „sla“, „additional“ zusätzlich). Überlappen sich Fenster beider
 * Arten, gilt in der Überlappung die zusätzliche Wartung.
 */
export type MaintenanceMode = 'A' | 'B' | 'C'

/** Rechenart je Art der Wartung. */
export type MaintenanceModes = Record<MaintenanceKind, MaintenanceMode>

export type MaintenanceWindow = { from: number; to: number; /** fehlt die Art, gilt „im Wartungsfenster (SLA)“ */ kind?: MaintenanceKind }

export type Outage = { from: number; to: number; status: 'partial' | 'major' }

export type ServiceMetrics = {
  knownMs: number
  downMs: number
  degradedMs: number
  /** Wartungszeit insgesamt, Summe von `maintenanceByKind` */
  maintenanceMs: number
  /** Wartungszeit je Art, ohne Doppelzählung: In der Überlappung zählt die zusätzliche Wartung */
  maintenanceByKind: Record<MaintenanceKind, number>
  /** Prozent, `null`: im Zeitraum ist kein Zustand bekannt */
  availability: number | null
  /** Ausfälle (Teilausfall, Schwerer Ausfall) außerhalb von Wartungen, aneinandergrenzende zusammengefasst */
  outages: Outage[]
}

export function computeServiceMetrics(input: {
  timeline: Timeline
  windows: MaintenanceWindow[]
  start: number
  end: number
  /** eine Rechenart für beide Arten oder je Art eine */
  mode: MaintenanceMode | MaintenanceModes
  /** Beginn des Dienstes: die Zeit davor wird nicht gewertet. */
  activeFrom?: number
  /** Ende des Dienstes (`null` oder fehlend: offen): die Zeit danach wird nicht gewertet. */
  activeTo?: number | null
}): ServiceMetrics {
  const { timeline } = input
  const modes: MaintenanceModes = typeof input.mode === 'string' ? { sla: input.mode, additional: input.mode } : input.mode
  // Gewertet wird nur die Lebenszeit des Dienstes. Davor und danach ist weder verfügbar noch unbekannt, es fehlt im Wert.
  const start = Math.max(input.start, input.activeFrom ?? Number.NEGATIVE_INFINITY)
  const end = Math.min(input.end, input.activeTo ?? Number.POSITIVE_INFINITY)
  if (end <= start) return { knownMs: 0, downMs: 0, degradedMs: 0, maintenanceMs: 0, maintenanceByKind: { sla: 0, additional: 0 }, availability: null, outages: [] }
  const windows = input.windows
    .map((window) => ({ from: Math.max(window.from, start), to: Math.min(window.to, end), kind: window.kind ?? ('sla' as MaintenanceKind) }))
    .filter((window) => window.to > window.from)

  const boundaries = new Set<number>([start, end])
  for (const entry of timeline) if (entry.at > start && entry.at < end) boundaries.add(entry.at)
  for (const window of windows) {
    boundaries.add(window.from)
    boundaries.add(window.to)
  }
  const points = Array.from(boundaries).sort((a, b) => a - b)

  let knownMs = 0
  let downMs = 0
  let degradedMs = 0
  let maintenanceMs = 0
  const maintenanceByKind: Record<MaintenanceKind, number> = { sla: 0, additional: 0 }
  const outages: Outage[] = []

  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i]
    const to = points[i + 1]
    const length = to - from
    const status = statusAt(timeline, from)
    if (status === null) continue
    const covering = windows.filter((window) => window.from <= from && from < window.to)
    // Überlappung: die zusätzliche Wartung gilt
    const kind: MaintenanceKind | null = covering.some((window) => window.kind === 'additional') ? 'additional' : covering.length > 0 ? 'sla' : null
    const inWindow = kind !== null
    const effective = status === 'maintenance' ? 'operational' : status
    const isOutage = effective === 'partial' || effective === 'major'

    const mode = kind ? modes[kind] : null
    if (kind) {
      maintenanceMs += length
      maintenanceByKind[kind] += length
    }
    if (mode !== 'C') knownMs += length
    if (effective === 'degraded' && !inWindow) degradedMs += length

    const counted = mode === 'B' ? true : isOutage && !inWindow
    if (counted) downMs += length

    if (isOutage && !inWindow) {
      const last = outages[outages.length - 1]
      if (last && last.to === from) {
        last.to = to
        if (effective === 'major') last.status = 'major'
      } else {
        outages.push({ from, to, status: effective })
      }
    }
  }

  return {
    knownMs,
    downMs,
    degradedMs,
    maintenanceMs,
    maintenanceByKind,
    availability: knownMs === 0 ? null : ((knownMs - downMs) / knownMs) * 100,
    outages,
  }
}
