import type { Payload } from 'payload'
import { DEFAULT_GROUP_ICON } from '@/lib/group-icons'
import { formatClockTime, formatDate, formatDateSlug, formatDateTime, formatTime, type DateTimeConfig } from '@/lib/datetime'
import { t, tf } from '@/lib/i18n'
import {
  computeAvailability,
  formatAvailability,
  groupStatusAt,
  knownSince,
  mergeTimelines,
  statusAt,
  worstStatus,
  type AvailabilityStatus,
  type Timeline,
} from '@/lib/availability'

export { computeAvailability, formatAvailability, groupStatusAt, knownSince, mergeTimelines, statusAt, worstStatus }
export type { Timeline }

/**
 * Lagebild: Balken der letzten 12 Stunden, Verfügbarkeit je Dienst und Einschränkungen der gewählten Rückschau.
 * Grundlage ist das Statusprotokoll (Collection „service-status-events“).
 */

export type LagebildStatus = AvailabilityStatus

/** Anzahl der Striche eines Balkens: 12 Stunden zu 5 Minuten (24 Stunden zu 10 Minuten). */
export const BAR_SLOTS = 144
export const BAR_HOURS = 12

/** Marke des zwischengespeicherten Lagebilds, damit eine Änderung es verwerfen kann. */
export const LAGEBILD_CACHE_TAG = 'lagebild'

/** Wie lange das berechnete Lagebild für alle Besucher gilt (Sekunden), wenn nichts anderes eingestellt ist. */
export const LAGEBILD_CACHE_SECONDS = 60

/** Liest `LAGEBILD_CACHE_SECONDS`: ganze Zahl von 0 bis 3600, `0` schaltet das Zwischenspeichern aus. Sonst die Vorgabe. */
export function parseCacheSeconds(value: unknown, fallback: number = LAGEBILD_CACHE_SECONDS): number {
  if (value === undefined || value === null || String(value).trim() === '') return fallback
  const seconds = Number(value)
  return Number.isInteger(seconds) && seconds >= 0 && seconds <= 3600 ? seconds : fallback
}

/** Wählbarer Zeitraum des Balkens in Stunden. Der erste Wert ist die Vorgabe. */
export const BAR_HOURS_OPTIONS = [12, 24] as const
export type BarHours = (typeof BAR_HOURS_OPTIONS)[number]

/** Wandelt einen Wert aus Adresse oder Einstellung in einen zulässigen Zeitraum des Balkens um, sonst `fallback`. */
export function parseBarHours(value: unknown, fallback: BarHours = BAR_HOURS): BarHours {
  const hours = Number(Array.isArray(value) ? value[0] : value)
  return (BAR_HOURS_OPTIONS as readonly number[]).includes(hours) ? (hours as BarHours) : fallback
}
export const PERIOD_DAYS = 14

/** Wählbare Rückschau in Tagen. Der erste Wert ist die Vorgabe. */
export const PERIOD_OPTIONS = [14, 30, 90, 180, 365] as const
export type PeriodDays = (typeof PERIOD_OPTIONS)[number]

/** Wandelt einen Wert aus Adresse oder Einstellung in eine zulässige Rückschau um, sonst `fallback`. */
export function parsePeriodDays(value: unknown, fallback: PeriodDays = PERIOD_DAYS): PeriodDays {
  const days = Number(Array.isArray(value) ? value[0] : value)
  return (PERIOD_OPTIONS as readonly number[]).includes(days) ? (days as PeriodDays) : fallback
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export type BarRun = {
  /** `null`: keine Daten */
  status: LagebildStatus | null
  /** Anzahl der Striche (Abschnitte) mit diesem Zustand */
  slots: number
}

/** Zeitfenster eines Balkens. Die Uhrzeit eines Strichs berechnet die Oberfläche aus `startMs`, `slotMinutes` und der Nummer. */
export type BarWindow = {
  /** Beginn des ersten Abschnitts in Millisekunden */
  startMs: number
  slotMinutes: number
  slots: number
  /** Zeitpunkt der Berechnung. Der letzte Abschnitt endet rechnerisch später, sein Ende zeigt die Oberfläche als „jetzt“. */
  nowMs: number
}

/** Fenster des Balkens. Die Abschnitte enden auf volle Vielfache ihrer Länge (12:05, 12:10 …), der letzte enthält `now`. */
export function computeBarWindow(now: number, hours: BarHours = BAR_HOURS): BarWindow {
  const slotMinutes = (hours * 60) / BAR_SLOTS
  const slotMs = slotMinutes * MINUTE
  const endMs = Math.ceil(now / slotMs) * slotMs
  return { startMs: endMs - BAR_SLOTS * slotMs, slotMinutes, slots: BAR_SLOTS, nowMs: now }
}

/** Uhrzeit für Anfang und Ende des Balkens. Liegt sie nicht am heutigen Tag, steht „gestern“ davor. */
function formatBarClock(date: Date, now: Date, dt: DateTimeConfig): string {
  const clock = formatClockTime(date, dt)
  return formatDateSlug(date, dt.timezone) === formatDateSlug(now, dt.timezone) ? clock : `${t('lagebild.yesterday')} ${clock}`
}

/** Schlechtester Zustand der Zeitleisten im Abschnitt [from, to). `null`: im Abschnitt ist kein Zustand bekannt. */
function worstInSlot(timelines: Timeline[], from: number, to: number): LagebildStatus | null {
  let worst: LagebildStatus | null = null
  for (const timeline of timelines) {
    worst = worstStatus([worst, statusAt(timeline, from)])
    for (const entry of timeline) {
      if (entry.at >= to) break
      if (entry.at > from) worst = worstStatus([worst, entry.status])
    }
  }
  return worst
}

/**
 * Balken als Folge von Abschnitten gleichen Zustands. Jeder Strich zeigt den schlechtesten Zustand seines Abschnitts,
 * damit ein kurzer Ausfall nicht zwischen zwei Abschnittsgrenzen verschwindet. Es wird keine Uhrzeit formatiert:
 * Das kostet je Aufruf 0,6 ms, und die Seite rechnet je Dienst einen Balken (Fork-Issue #23).
 */
export function computeBarRuns(timelines: Timeline[], window: BarWindow): BarRun[] {
  const slotMs = window.slotMinutes * MINUTE
  const runs: BarRun[] = []
  for (let i = 0; i < window.slots; i++) {
    const from = window.startMs + i * slotMs
    const status = worstInSlot(timelines, from, from + slotMs)
    const last = runs[runs.length - 1]
    if (last && last.status === status) last.slots += 1
    else runs.push({ status, slots: 1 })
  }
  return runs
}

export type RawPeriod = {
  status: LagebildStatus
  start: number
  /** `null`: dauert an */
  end: number | null
}

/** Zeiträume der letzten `periodDays` Tage, in denen eine Gruppe nicht „Betriebsbereit“ war. */
export function computePeriods(timelines: Timeline[], now: number, periodDays: number = PERIOD_DAYS): RawPeriod[] {
  const windowStart = now - periodDays * DAY
  const points = new Set<number>([windowStart])
  for (const timeline of timelines) {
    for (const entry of timeline) {
      if (entry.at > windowStart && entry.at <= now) points.add(entry.at)
    }
  }
  const sorted = Array.from(points).sort((a, b) => a - b)

  const periods: RawPeriod[] = []
  let current: RawPeriod | null = null
  for (const point of sorted) {
    const status = groupStatusAt(timelines, point)
    const impaired = status !== null && status !== 'operational'
    if (current && (!impaired || status !== current.status)) {
      current.end = point
      periods.push(current)
      current = null
    }
    if (impaired && !current) current = { status: status as LagebildStatus, start: point, end: null }
  }
  if (current) periods.push(current)
  return periods
}

export type LagebildService = {
  id: string
  name: string
  status: LagebildStatus
  bars: BarRun[]
  /** Verfügbarkeit in Prozent im gewählten Zeitraum, `null`: unbekannt */
  availability: number | null
  /** Verfügbarkeit als Text, z. B. „99,87 %“. Leer, wenn unbekannt. */
  availabilityLabel: string
  /** Beginn der bekannten Zeit als Text („seit …“), wenn das Statusprotokoll kürzer zurückreicht als die Rückschau. Sonst leer. */
  availabilitySince: string
}

export type LagebildGroup = {
  id: string
  name: string
  icon: string
  /** aktueller Zustand = schlechtester Zustand der Dienste */
  status: LagebildStatus
  bars: BarRun[]
  /** Verfügbarkeit der Gruppe in Prozent im gewählten Zeitraum, `null`: unbekannt. Ein Ausfall eines Dienstes zählt für die Gruppe. */
  availability: number | null
  /** Verfügbarkeit der Gruppe als Text, z. B. „99,87 %“. Leer, wenn unbekannt. */
  availabilityLabel: string
  services: LagebildService[]
}

export type LagebildPeriod = {
  id: string
  groupId: string
  groupName: string
  groupIcon: string
  status: LagebildStatus
  title: string
  /** Beginn in Millisekunden, dient der Sortierung */
  start: number
  dayKey: string
  dayLabel: string
  range: string
  related: { title: string; href: string } | null
}

export type LagebildData = {
  groups: LagebildGroup[]
  /** Balken über alle Dienste aller Gruppen (Kachel „Alle“) */
  allBars: BarRun[]
  periods: LagebildPeriod[]
  /** Gewählte Rückschau in Tagen */
  periodDays: PeriodDays
  /** Tage der Rückschau, neuester zuerst */
  days: Array<{ dayKey: string; dayLabel: string }>
  /** Beginn und Ende des Balkens als Uhrzeit, z. B. „09:10“ und „21:10“ */
  barsFrom: string
  barsTo: string
  /** Gewählter Zeitraum des Balkens in Stunden */
  barHours: BarHours
  /** Angaben, aus denen die Oberfläche die Uhrzeit eines Strichs berechnet („gestern“ vor Zeiten des Vortags) */
  bar: BarWindow & { locale: string; timeZone: string; yesterday: string }
}

export function statusLabel(status: LagebildStatus): string {
  switch (status) {
    case 'operational':
      return t('status.operational')
    case 'degraded':
      return t('status.degraded')
    case 'partial':
      return t('status.partial')
    case 'major':
      return t('status.major')
    case 'maintenance':
      return t('status.maintenance')
  }
}

type Related = { title: string; href: string; serviceIds: string[]; from: number; to: number }

/** Lädt Gruppen, Dienste und Protokoll und berechnet das Lagebild. */
export async function loadLagebild(
  payload: Payload,
  dt: DateTimeConfig,
  periodDays: PeriodDays = PERIOD_DAYS,
  barHours: BarHours = BAR_HOURS,
  nowDate = new Date(),
): Promise<LagebildData> {
  const now = nowDate.getTime()
  const windowStart = now - periodDays * DAY
  const barWindow = computeBarWindow(now, barHours)

  const [groupsResult, servicesResult] = await Promise.all([
    payload.find({ collection: 'service-groups', sort: '_order', depth: 0, pagination: false }),
    payload.find({ collection: 'services', depth: 0, pagination: false }),
  ])

  const serviceIds = servicesResult.docs.map((service) => service.id)
  const [windowEvents, earlier, incidents, maintenances] = await Promise.all([
    payload.find({
      collection: 'service-status-events',
      where: { changedAt: { greater_than: new Date(windowStart).toISOString() } },
      sort: 'changedAt',
      depth: 0,
      pagination: false,
    }),
    // Letzter Eintrag vor dem Zeitfenster: Zustand zu Beginn der Rückschau
    Promise.all(
      serviceIds.map(async (id) => {
        const result = await payload.find({
          collection: 'service-status-events',
          where: { and: [{ service: { equals: id } }, { changedAt: { less_than_equal: new Date(windowStart).toISOString() } }] },
          sort: '-changedAt',
          limit: 1,
          depth: 0,
        })
        return result.docs[0]
      }),
    ),
    payload.find({
      collection: 'incidents',
      where: {
        or: [
          { resolvedAt: { greater_than: new Date(windowStart).toISOString() } },
          { status: { not_equals: 'resolved' } },
        ],
      },
      depth: 0,
      limit: 500,
    }),
    payload.find({
      collection: 'maintenances',
      where: { scheduledStartAt: { greater_than: new Date(windowStart - DAY).toISOString() } },
      depth: 0,
      limit: 500,
    }),
  ])

  // Zustandsfolge je Dienst
  const timelines = new Map<string, Timeline>()
  const push = (serviceId: unknown, at: string, status: LagebildStatus) => {
    const key = String(typeof serviceId === 'object' && serviceId ? (serviceId as { id: unknown }).id : serviceId)
    const list = timelines.get(key) ?? []
    list.push({ at: new Date(at).getTime(), status })
    timelines.set(key, list)
  }
  for (const event of earlier) if (event) push(event.service, event.changedAt, event.status)
  for (const event of windowEvents.docs) push(event.service, event.changedAt, event.status)
  for (const list of timelines.values()) list.sort((a, b) => a.at - b.at)

  const idOf = (value: unknown) => String(typeof value === 'object' && value ? (value as { id: unknown }).id : value)

  const related: Related[] = [
    ...incidents.docs.map((incident) => ({
      title: incident.title,
      href: `/i/${incident.shortId}`,
      serviceIds: (incident.affectedServices || []).map(idOf),
      from: new Date(incident.createdAt).getTime(),
      to: incident.resolvedAt ? new Date(incident.resolvedAt).getTime() : now,
    })),
    ...maintenances.docs.map((maintenance) => ({
      title: maintenance.title,
      href: `/m/${maintenance.shortId}`,
      serviceIds: (maintenance.affectedServices || []).map(idOf),
      from: new Date(maintenance.scheduledStartAt).getTime(),
      to: new Date(maintenance.completedAt || maintenance.cancelledAt || maintenance.scheduledEndAt || now).getTime(),
    })),
  ]

  const groups: LagebildGroup[] = []
  const periods: LagebildPeriod[] = []
  const allTimelines: Timeline[] = []

  for (const group of groupsResult.docs) {
    const groupServices = servicesResult.docs.filter((service) => idOf(service.group) === String(group.id))
    if (groupServices.length === 0) continue
    const groupTimelines = groupServices.map((service) => timelines.get(String(service.id)) ?? [])
    const icon = group.icon || DEFAULT_GROUP_ICON
    const groupId = String(group.id)
    allTimelines.push(...groupTimelines)
    const groupAvailability = computeAvailability(mergeTimelines(groupTimelines), windowStart, now)

    groups.push({
      id: groupId,
      name: group.name,
      icon,
      status: worstStatus(groupServices.map((service) => service.status)) ?? 'operational',
      bars: computeBarRuns(groupTimelines, barWindow),
      availability: groupAvailability,
      availabilityLabel: formatAvailability(groupAvailability, dt.locale),
      services: groupServices.map((service) => {
        const timeline = timelines.get(String(service.id)) ?? []
        const availability = computeAvailability(timeline, windowStart, now)
        const since = knownSince(timeline, windowStart, now)
        const availabilitySince =
          since !== null && since > windowStart ? tf('lagebild.since', { time: formatDateTime(new Date(since), dt) }) : ''
        return {
          id: String(service.id),
          name: service.name,
          status: service.status,
          bars: computeBarRuns([timeline], barWindow),
          availability,
          availabilityLabel: formatAvailability(availability, dt.locale),
          availabilitySince,
        }
      }),
    })

    for (const period of computePeriods(groupTimelines, now, periodDays)) {
      const end = period.end ?? now
      const hit = related.find(
        (entry) =>
          entry.from <= end &&
          entry.to >= period.start &&
          entry.serviceIds.some((id) => groupServices.some((service) => String(service.id) === id)),
      )
      const startDate = new Date(period.start)
      const endLabel =
        period.end === null
          ? t('lagebild.ongoing')
          : formatDateSlug(new Date(period.end), dt.timezone) === formatDateSlug(startDate, dt.timezone)
            ? formatTime(new Date(period.end), dt)
            : formatDateTime(new Date(period.end), dt)
      periods.push({
        id: `${groupId}-${period.start}`,
        groupId,
        groupName: group.name,
        groupIcon: icon,
        status: period.status,
        start: period.start,
        title: tf('lagebild.periodTitle', { status: statusLabel(period.status), group: group.name }),
        dayKey: formatDateSlug(startDate, dt.timezone),
        dayLabel: formatDate(startDate, dt),
        range: `${formatTime(startDate, dt)} – ${endLabel}`,
        related: hit ? { title: hit.title, href: hit.href } : null,
      })
    }
  }

  // neueste zuerst
  periods.sort((a, b) => b.start - a.start)

  const days: LagebildData['days'] = []
  for (let i = 0; i < periodDays; i++) {
    const date = new Date(now - i * DAY)
    days.push({ dayKey: formatDateSlug(date, dt.timezone), dayLabel: formatDate(date, dt) })
  }

  return {
    groups,
    allBars: computeBarRuns(allTimelines, barWindow),
    periods,
    periodDays,
    days,
    barsFrom: formatBarClock(new Date(barWindow.startMs), nowDate, dt),
    barsTo: formatBarClock(nowDate, nowDate, dt),
    barHours,
    bar: { ...barWindow, locale: dt.locale, timeZone: dt.timezone, yesterday: t('lagebild.yesterday') },
  }
}
