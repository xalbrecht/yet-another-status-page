import { statusAt, type Timeline } from '@/lib/availability'

/**
 * Kennzahlen eines Dienstes in einem Zeitraum (Konzept 4.1, 4.7 und 4.8). Reine Funktion.
 * Der Zeitraum wird an den Einträgen der Zeitleiste und den Wartungsfenstern in Abschnitte geteilt.
 * „In Wartung“ gilt nur für die Wartungsfenster. Der Zustand `maintenance` im Protokoll zählt wie `operational`.
 *
 * Wartungsart A: Wartung zählt als verfügbar, Störungen in der Wartung zählen nicht.
 * Wartungsart B: Wartung zählt als Ausfall.
 * Wartungsart C: Wartung ist aus der Gesamtzeit herausgenommen.
 */
export type MaintenanceMode = 'A' | 'B' | 'C'

export type Outage = { from: number; to: number; status: 'partial' | 'major' }

export type ServiceMetrics = {
  knownMs: number
  downMs: number
  degradedMs: number
  maintenanceMs: number
  /** Prozent, `null`: im Zeitraum ist kein Zustand bekannt */
  availability: number | null
  /** Ausfälle (Teilausfall, Schwerer Ausfall) außerhalb von Wartungen, aneinandergrenzende zusammengefasst */
  outages: Outage[]
}

export function computeServiceMetrics(input: {
  timeline: Timeline
  windows: Array<{ from: number; to: number }>
  start: number
  end: number
  mode: MaintenanceMode
}): ServiceMetrics {
  const { timeline, start, end, mode } = input
  const windows = input.windows
    .map((window) => ({ from: Math.max(window.from, start), to: Math.min(window.to, end) }))
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
  const outages: Outage[] = []

  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i]
    const to = points[i + 1]
    const length = to - from
    const status = statusAt(timeline, from)
    if (status === null) continue
    const inWindow = windows.some((window) => window.from <= from && from < window.to)
    const effective = status === 'maintenance' ? 'operational' : status
    const isOutage = effective === 'partial' || effective === 'major'

    if (inWindow) maintenanceMs += length
    if (!(mode === 'C' && inWindow)) knownMs += length
    if (effective === 'degraded' && !inWindow) degradedMs += length

    const counted = mode === 'B' ? inWindow || isOutage : isOutage && !inWindow
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
    availability: knownMs === 0 ? null : ((knownMs - downMs) / knownMs) * 100,
    outages,
  }
}
