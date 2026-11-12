import type { Timeline } from '@/lib/availability'
import { addZonedDays, formatDateSlug, startOfZonedDay } from '@/lib/datetime'
import { computeServiceMetrics, type MaintenanceMode } from '@/lib/report/metrics'
import type { ReportPeriod } from '@/lib/report/period'

/**
 * Störungen eines Monats für das Gruppenblatt (Konzept 4, Blöcke 3 und 4): je Dienst die Dauer nach Art der Störung
 * und je Tag die betroffenen Dienste. Reine Funktionen ohne Datenbankzugriff, Tagesgrenzen gelten in der Zeitzone
 * der Einstellungen. Aneinandergrenzende Ausfälle sind in `computeServiceMetrics` zusammengefasst und zählen als
 * der schlechtere Zustand.
 */
export type GroupSheetData = {
  month: { key: string; label: string }
  /** nur Dienste mit Ausfall oder Einschränkung im Monat, längste Ausfallzeit zuerst */
  perService: Array<{ serviceId: number; name: string; majorMs: number; partialMs: number; degradedMs: number }>
  /** jeder Tag des Monats in Reihenfolge, auch ohne Ausfall; Balken längste Dauer zuerst */
  perDay: Array<{
    day: string
    dayOfMonth: number
    bars: Array<{ serviceId: number; name: string; status: 'partial' | 'major'; ms: number }>
  }>
}

/**
 * Beginn des nächsten Tages in der Zeitzone. Gibt es Mitternacht am Umstellungstag nicht (z. B. America/Santiago), liefert
 * `startOfZonedDay` den Ausgangspunkt selbst zurück. Dann geht es stundenweise weiter, damit die Schleifen enden.
 */
function nextDayStart(cursor: number, timeZone: string): number {
  const next = startOfZonedDay(addZonedDays(new Date(cursor), 1, timeZone), timeZone).getTime()
  return next > cursor ? next : cursor + 3_600_000
}

/** Teilt einen Ausfall an den Tagesgrenzen der Zeitzone. `day` ist `YYYY-MM-DD`, die Summe der `ms` gleich `to - from`. */
export function splitOutageByDay(outage: { from: number; to: number }, timeZone: string): Array<{ day: string; ms: number }> {
  const parts: Array<{ day: string; ms: number }> = []
  let cursor = outage.from
  while (cursor < outage.to) {
    const end = Math.min(outage.to, nextDayStart(cursor, timeZone))
    const day = formatDateSlug(new Date(cursor), timeZone)
    const last = parts[parts.length - 1]
    if (last && last.day === day) last.ms += end - cursor
    else parts.push({ day, ms: end - cursor })
    cursor = end
  }
  return parts
}

export function buildGroupSheet(input: {
  month: ReportPeriod
  services: Array<{ id: number; name: string; timeline: Timeline; windows: Array<{ from: number; to: number }> }>
  mode: MaintenanceMode
  timeZone: string
}): GroupSheetData {
  const { month, timeZone } = input
  const days: GroupSheetData['perDay'] = []
  const dayIndex = new Map<string, GroupSheetData['perDay'][number]>()
  for (let cursor = startOfZonedDay(new Date(month.start), timeZone).getTime(); cursor < month.end; ) {
    const day = formatDateSlug(new Date(cursor), timeZone)
    if (!dayIndex.has(day)) {
      const entry = { day, dayOfMonth: Number.parseInt(day.slice(8, 10), 10), bars: [] }
      days.push(entry)
      dayIndex.set(day, entry)
    }
    cursor = nextDayStart(cursor, timeZone)
  }

  const perService: GroupSheetData['perService'] = []
  for (const service of input.services) {
    const metrics = computeServiceMetrics({
      timeline: service.timeline,
      windows: service.windows,
      start: month.start,
      end: month.end,
      mode: input.mode,
    })
    let majorMs = 0
    let partialMs = 0
    for (const outage of metrics.outages) {
      if (outage.status === 'major') majorMs += outage.to - outage.from
      else partialMs += outage.to - outage.from
      for (const part of splitOutageByDay(outage, timeZone)) {
        const bars = dayIndex.get(part.day)?.bars
        if (!bars) continue
        const existing = bars.find((bar) => bar.serviceId === service.id && bar.status === outage.status)
        if (existing) existing.ms += part.ms
        else bars.push({ serviceId: service.id, name: service.name, status: outage.status, ms: part.ms })
      }
    }
    if (majorMs + partialMs + metrics.degradedMs > 0) {
      perService.push({ serviceId: service.id, name: service.name, majorMs, partialMs, degradedMs: metrics.degradedMs })
    }
  }

  perService.sort((a, b) => b.majorMs + b.partialMs - (a.majorMs + a.partialMs) || a.name.localeCompare(b.name, 'de'))
  for (const day of days) day.bars.sort((a, b) => b.ms - a.ms || a.name.localeCompare(b.name, 'de'))
  return { month: { key: month.key, label: month.label }, perService, perDay: days }
}
