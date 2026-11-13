import { resolveAvailabilityTarget, type Timeline } from '@/lib/availability'
import { buildGroupSheet, type GroupSheetData } from '@/lib/report/group-sheet'
import { heatClass, type HeatLevel } from '@/lib/report/heat'
import { computeServiceMetrics, type ServiceMetrics } from '@/lib/report/metrics'
import type { ReportParams } from '@/lib/report/params'
import { periodMonths, type ReportPeriod } from '@/lib/report/period'

/**
 * Berichtsdaten aus den Verläufen der Dienste (Konzept 4 und 6). Reine Funktion ohne Datenbankzugriff.
 * Gruppen- und Gesamtwert sind der Mittelwert der Dienste, jeder gleich gewichtet (Konzept 9, Annahmen 3 und 4).
 */
export type ReportInput = {
  period: ReportPeriod
  previous: ReportPeriod
  /** die 12 Monate des Verlaufs, aufsteigend */
  months: ReportPeriod[]
  params: ReportParams
  globalTarget: number
  groups: Array<{ id: number; name: string; target?: number | null }>
  services: Array<{
    id: number
    name: string
    groupId: number
    target?: number | null
    timeline: Timeline
    windows: Array<{ from: number; to: number }>
  }>
  footnotes: { unsure: number; withoutService: number }
  now: number
  timeZone: string
  locale: string
}

export type RankingRow = {
  serviceId: number
  name: string
  groupName: string
  availability: number | null
  previousAvailability: number | null
  /** Ausfallzeit, wie sie in den Wert eingeht (bei Wartungsart B einschließlich der Wartung) */
  downMs: number
  outageCount: number
  longestOutageMs: number
  /** Anteil der Wartung an `downMs`, nur bei Wartungsart B */
  maintenanceDownMs: number
  /** Dauer „Eingeschränkt“ und Wartungszeit im Zeitraum (für den Export) */
  degradedMs: number
  maintenanceMs: number
  /** einzelne Ausfälle im Zeitraum, aneinandergrenzende zusammengefasst */
  outages: Array<{ from: number; to: number; status: 'partial' | 'major' }>
  target: number
  belowTarget: boolean
  history: Array<number | null>
}

/** Eintrag der Gruppenliste (Konzept 4): Gruppenwert als Mittelwert der Dienste, `level` ist die Farbstufe der Wärmekarte. */
export type GroupListEntry = {
  id: number
  name: string
  serviceCount: number
  availability: number | null
  target: number
  level: HeatLevel
}

export type ReportData = {
  /** Text bei ungültiger Eingabe, die übrigen Felder sind dann leer */
  error?: string
  scope: { groupId: number | null; groupName: string | null; serviceCount: number }
  kpis: {
    availability: number | null
    previousAvailability: number | null
    downMs: number
    previousDownMs: number
    affectedServices: number
    serviceCount: number
    outageCount: number
    longestOutage: { ms: number; serviceName: string } | null
    degradedMs: number
    maintenanceMs: number
    monthsMet: number
    monthsTotal: number
    target: number
  }
  weakest: RankingRow[]
  trend: Array<{ key: string; label: string; availability: number | null }>
  heat: {
    columns: Array<{ key: string; label: string }>
    rows: Array<{ name: string; values: Array<number | null>; total?: boolean }>
  }
  ranking: RankingRow[]
  /** alle Gruppen mit Diensten, schwächste zuerst, unabhängig von der Gruppenwahl */
  groupList: GroupListEntry[]
  /** Störungen des letzten Monats im Zeitraum, nur bei gewählter Gruppe */
  sheet: GroupSheetData | null
  footnotes: { unsure: number; withoutService: number }
}

const mean = (values: Array<number | null>): number | null => {
  const known = values.filter((value): value is number => value !== null)
  return known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0) / known.length
}

const emptyData = (input: ReportInput, error: string): ReportData => ({
  error,
  scope: { groupId: null, groupName: null, serviceCount: 0 },
  kpis: {
    availability: null,
    previousAvailability: null,
    downMs: 0,
    previousDownMs: 0,
    affectedServices: 0,
    serviceCount: 0,
    outageCount: 0,
    longestOutage: null,
    degradedMs: 0,
    maintenanceMs: 0,
    monthsMet: 0,
    monthsTotal: 0,
    target: input.globalTarget,
  },
  weakest: [],
  trend: [],
  heat: { columns: [], rows: [] },
  ranking: [],
  groupList: [],
  sheet: null,
  footnotes: input.footnotes,
})

export function buildReport(input: ReportInput): ReportData {
  const { params, period, previous, months, now, locale, timeZone } = input
  const groupById = new Map(input.groups.map((group) => [group.id, group]))

  let scopeGroup: ReportInput['groups'][number] | null = null
  if (params.group) {
    scopeGroup = input.groups.find((group) => String(group.id) === params.group) ?? null
    if (!scopeGroup) return emptyData(input, 'Die gewählte Gruppe wurde nicht gefunden.')
  }
  const services = input.services.filter((service) => !scopeGroup || service.groupId === scopeGroup.id)

  const metricsFor = (service: ReportInput['services'][number], range: ReportPeriod): ServiceMetrics =>
    computeServiceMetrics({ timeline: service.timeline, windows: service.windows, start: range.start, end: range.end, mode: params.maintenance })

  // Die Zerlegung in Monate ist teuer und gilt für alle Dienste: einmal je Zeitraum berechnen
  const periodParts = periodMonths(period, now, locale, timeZone)
  const previousParts = periodMonths(previous, now, locale, timeZone)

  /** Wert eines Dienstes für einen Zeitraum: Rechenart 1 ein Wert, Rechenart 2 Mittel der Monatswerte */
  const valueFor = (service: ReportInput['services'][number], range: ReportPeriod, parts: ReportPeriod[]): number | null => {
    if (params.calc === 'monthly' && parts.length > 0) return mean(parts.map((part) => metricsFor(service, part).availability))
    return metricsFor(service, range).availability
  }

  const periodValues = new Map<number, number | null>()
  const periodValue = (service: ReportInput['services'][number]): number | null => {
    if (!periodValues.has(service.id)) periodValues.set(service.id, valueFor(service, period, periodParts))
    return periodValues.get(service.id) ?? null
  }

  const target = scopeGroup ? resolveAvailabilityTarget({ group: scopeGroup.target, global: input.globalTarget }) : input.globalTarget

  const rows = services.map((service) => {
    const group = groupById.get(service.groupId)
    const whole = metricsFor(service, period)
    const availability = periodValue(service)
    const serviceTarget = resolveAvailabilityTarget({ service: service.target, group: group?.target, global: input.globalTarget })
    const row: RankingRow = {
      serviceId: service.id,
      name: service.name,
      groupName: group?.name ?? '',
      availability,
      previousAvailability: valueFor(service, previous, previousParts),
      downMs: whole.downMs,
      outageCount: whole.outages.length,
      longestOutageMs: Math.max(0, ...whole.outages.map((outage) => outage.to - outage.from)),
      maintenanceDownMs: params.maintenance === 'B' ? whole.maintenanceMs : 0,
      degradedMs: whole.degradedMs,
      maintenanceMs: whole.maintenanceMs,
      outages: whole.outages,
      target: serviceTarget,
      belowTarget: availability !== null && availability < serviceTarget,
      history: months.map((month) => metricsFor(service, month).availability),
    }
    return { service, whole, row }
  })

  const ranking = rows
    .map((entry) => entry.row)
    .sort((a, b) => {
      if (a.availability === null && b.availability === null) return a.name.localeCompare(b.name, 'de')
      if (a.availability === null) return 1
      if (b.availability === null) return -1
      return a.availability - b.availability || b.downMs - a.downMs || a.name.localeCompare(b.name, 'de')
    })

  let longestOutage: ReportData['kpis']['longestOutage'] = null
  for (const entry of rows) {
    for (const outage of entry.whole.outages) {
      const ms = outage.to - outage.from
      if (!longestOutage || ms > longestOutage.ms) longestOutage = { ms, serviceName: entry.service.name }
    }
  }

  const monthValues = periodParts.map((part) => mean(services.map((service) => metricsFor(service, part).availability)))
  const monthsTotal = monthValues.filter((value) => value !== null).length
  const monthsMet = monthValues.filter((value) => value !== null && value >= target).length

  const historyOf = (subset: typeof services): Array<number | null> =>
    months.map((month) => mean(subset.map((service) => metricsFor(service, month).availability)))

  const heatRows: ReportData['heat']['rows'] = []
  if (scopeGroup) {
    for (const entry of rows) heatRows.push({ name: entry.row.name, values: entry.row.history })
  } else {
    for (const group of input.groups) {
      const members = services.filter((service) => service.groupId === group.id)
      if (members.length > 0) heatRows.push({ name: group.name, values: historyOf(members) })
    }
  }
  const worstOf = (values: Array<number | null>) => Math.min(...values.map((value) => value ?? Number.POSITIVE_INFINITY))
  heatRows.sort((a, b) => worstOf(a.values) - worstOf(b.values) || a.name.localeCompare(b.name, 'de'))
  const trendValues = historyOf(services)

  const groupList: GroupListEntry[] = input.groups
    .flatMap((group) => {
      const members = input.services.filter((service) => service.groupId === group.id)
      if (members.length === 0) return []
      const availability = mean(members.map(periodValue))
      const groupTarget = resolveAvailabilityTarget({ group: group.target, global: input.globalTarget })
      return [{ id: group.id, name: group.name, serviceCount: members.length, availability, target: groupTarget, level: heatClass(availability, groupTarget) }]
    })
    .sort((a, b) => {
      if (a.availability === null || b.availability === null) {
        return Number(a.availability === null) - Number(b.availability === null) || a.name.localeCompare(b.name, 'de')
      }
      return a.availability - b.availability || a.name.localeCompare(b.name, 'de')
    })

  const lastMonth = periodParts[periodParts.length - 1]
  const sheet =
    scopeGroup && lastMonth
      ? buildGroupSheet({
          month: lastMonth,
          services: services.map(({ id, name, timeline, windows }) => ({ id, name, timeline, windows })),
          mode: params.maintenance,
          timeZone,
        })
      : null

  return {
    scope: { groupId: scopeGroup?.id ?? null, groupName: scopeGroup?.name ?? null, serviceCount: services.length },
    kpis: {
      availability: mean(rows.map((entry) => entry.row.availability)),
      previousAvailability: mean(rows.map((entry) => entry.row.previousAvailability)),
      downMs: rows.reduce((sum, entry) => sum + entry.whole.downMs, 0),
      previousDownMs: services.reduce((sum, service) => sum + metricsFor(service, previous).downMs, 0),
      affectedServices: rows.filter((entry) => entry.whole.outages.length > 0).length,
      serviceCount: services.length,
      outageCount: rows.reduce((sum, entry) => sum + entry.whole.outages.length, 0),
      longestOutage,
      degradedMs: rows.reduce((sum, entry) => sum + entry.whole.degradedMs, 0),
      maintenanceMs: rows.reduce((sum, entry) => sum + entry.whole.maintenanceMs, 0),
      monthsMet,
      monthsTotal,
      target,
    },
    weakest: ranking.filter((row) => row.downMs > 0).slice(0, params.topN),
    trend: months.map((month, index) => ({ key: month.key, label: month.label, availability: trendValues[index] })),
    heat: {
      columns: months.map((month) => ({ key: month.key, label: month.label })),
      rows: [{ name: 'Gesamt', values: trendValues, total: true }, ...heatRows],
    },
    ranking,
    groupList,
    sheet,
    footnotes: input.footnotes,
  }
}
