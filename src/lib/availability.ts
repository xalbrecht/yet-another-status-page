import type { Service } from '@/payload-types'

/**
 * Gemeinsame Rechenregeln für Lagebild und Verfügbarkeitsbericht (Konzept 4.1 und 4.6).
 * Grundlage ist der Verlauf je Dienst aus dem Statusprotokoll. Diese Datei enthält keinen Datenbankzugriff.
 */

export type AvailabilityStatus = Service['status']

const SEVERITY: Record<AvailabilityStatus, number> = {
  operational: 0,
  maintenance: 1,
  degraded: 2,
  partial: 3,
  major: 4,
}

/** Zustandsfolge eines Dienstes, aufsteigend nach Zeitpunkt (Millisekunden). */
export type Timeline = Array<{ at: number; status: AvailabilityStatus }>

/** Zustand eines Dienstes zum Zeitpunkt `time`. `null`: vor dem ersten Protokolleintrag unbekannt. */
export function statusAt(timeline: Timeline, time: number): AvailabilityStatus | null {
  let result: AvailabilityStatus | null = null
  for (const entry of timeline) {
    if (entry.at <= time) result = entry.status
    else break
  }
  return result
}

/** Schlechtester bekannter Zustand. `null`, wenn kein Zustand bekannt ist. */
export function worstStatus(statuses: Array<AvailabilityStatus | null | undefined>): AvailabilityStatus | null {
  let worst: AvailabilityStatus | null = null
  for (const status of statuses) {
    if (!status) continue
    if (worst === null || SEVERITY[status] > SEVERITY[worst]) worst = status
  }
  return worst
}

/** Zustand einer Gruppe: schlechtester Zustand ihrer Dienste zum Zeitpunkt `time`. */
export function groupStatusAt(timelines: Timeline[], time: number): AvailabilityStatus | null {
  return worstStatus(timelines.map((timeline) => statusAt(timeline, time)))
}

/**
 * Zusammengefasste Zeitfolge mehrerer Dienste: an jedem Wechselzeitpunkt der schlechteste Zustand aller Zeitfolgen.
 * Die Zeitpunkte sind aufsteigend, aufeinanderfolgende gleiche Zustände entfallen. Vor dem ersten Eintrag aller
 * Zeitfolgen ist nichts bekannt, die Folge beginnt erst mit dem ersten bekannten Zustand.
 */
export function mergeTimelines(timelines: Timeline[]): Timeline {
  const times = Array.from(new Set(timelines.flatMap((timeline) => timeline.map((entry) => entry.at)))).sort((a, b) => a - b)
  const next = timelines.map(() => 0)
  const current: Array<AvailabilityStatus | null> = timelines.map(() => null)
  const merged: Timeline = []
  for (const time of times) {
    timelines.forEach((timeline, i) => {
      while (next[i] < timeline.length && timeline[next[i]].at <= time) current[i] = timeline[next[i]++].status
    })
    const status = worstStatus(current)
    if (status !== null && merged[merged.length - 1]?.status !== status) merged.push({ at: time, status })
  }
  return merged
}

/**
 * Verfügbarkeit eines Dienstes in Prozent: Anteil der bekannten Zeit seit `windowStart`, in der der Dienst
 * weder „Teilausfall“ noch „Schwerer Ausfall“ hatte. „Eingeschränkt“ und „Wartung“ zählen als verfügbar.
 * `null`: im Zeitraum ist kein Zustand bekannt.
 */
export function computeAvailability(timeline: Timeline, windowStart: number, now: number): number | null {
  let known = 0
  let down = 0
  let status = statusAt(timeline, windowStart)
  let cursor = windowStart
  const close = (until: number) => {
    if (status === null || until <= cursor) return
    known += until - cursor
    if (status === 'partial' || status === 'major') down += until - cursor
  }
  for (const entry of timeline) {
    if (entry.at <= windowStart) continue
    if (entry.at > now) break
    if (status === null) cursor = entry.at
    else close(entry.at)
    status = entry.status
    cursor = entry.at
  }
  close(now)
  return known === 0 ? null : ((known - down) / known) * 100
}

/**
 * Dauer je Zustand in Millisekunden im Fenster `windowStart` bis `now`, nur für die bekannte Zeit.
 * `knownMs` ist die Summe aller Zustände. Zeit ohne bekannten Zustand zählt nicht.
 */
export function computeStatusDurations(
  timeline: Timeline,
  windowStart: number,
  now: number,
): { knownMs: number; byStatus: Record<AvailabilityStatus, number> } {
  const byStatus: Record<AvailabilityStatus, number> = { operational: 0, degraded: 0, partial: 0, major: 0, maintenance: 0 }
  let status = statusAt(timeline, windowStart)
  let cursor = windowStart
  const close = (until: number) => {
    if (status === null || until <= cursor) return
    byStatus[status] += until - cursor
  }
  for (const entry of timeline) {
    if (entry.at <= windowStart) continue
    if (entry.at > now) break
    if (status === null) cursor = entry.at
    else close(entry.at)
    status = entry.status
    cursor = entry.at
  }
  close(now)
  const knownMs = Object.values(byStatus).reduce((sum, value) => sum + value, 0)
  return { knownMs, byStatus }
}

/**
 * Zeitpunkt, ab dem im Fenster ein Zustand bekannt ist. `windowStart`, wenn schon vor dem Fenster einer bekannt war,
 * sonst der erste Eintrag im Fenster. `null`: im Fenster ist kein Zustand bekannt.
 */
export function knownSince(timeline: Timeline, windowStart: number, now: number): number | null {
  if (statusAt(timeline, windowStart) !== null) return windowStart
  const first = timeline.find((entry) => entry.at > windowStart && entry.at <= now)
  return first ? first.at : null
}

/** Verfügbarkeit mit zwei Nachkommastellen, abgerundet: 99,996 % erscheint nicht als 100,00 %. */
export function formatAvailability(value: number | null, locale: string): string {
  if (value === null) return ''
  const floored = Math.floor(value * 100) / 100
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(floored)} %`
}

/** Gesamtzielwert in Prozent, wenn weder Gruppe noch Dienst einen eigenen Wert hat und die Einstellung leer ist. */
export const DEFAULT_AVAILABILITY_TARGET = 99

/**
 * Zielwert eines Dienstes in Prozent: der erste gesetzte Wert in der Reihenfolge Dienst, Gruppe, Gesamt (Konzept 4.4).
 * `0` ist ein gültiger Wert. Nur `null` und `undefined` gelten als nicht gesetzt.
 */
export function resolveAvailabilityTarget(levels: {
  service?: number | null
  group?: number | null
  global?: number | null
}): number {
  for (const value of [levels.service, levels.group, levels.global]) {
    if (value !== null && value !== undefined) return value
  }
  return DEFAULT_AVAILABILITY_TARGET
}
