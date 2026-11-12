import type { Payload } from 'payload'
import type { Timeline } from '@/lib/availability'
import { DEFAULT_AVAILABILITY_TARGET } from '@/lib/availability'
import { resolveDateTimeConfig } from '@/lib/datetime'
import { buildReport, type ReportData } from '@/lib/report/aggregate'
import { countFootnotes } from '@/lib/report/footnotes'
import { maintenanceWindow } from '@/lib/report/maintenance-time'
import { parseReportParams, type ReportParams } from '@/lib/report/params'
import { reportDataEnd, resolvePeriod, type ReportPeriod } from '@/lib/report/period'

/**
 * Lädt die Daten für den Verfügbarkeitsbericht und baut daraus die Berichtsdaten (Konzept 6). Gemeinsam genutzt von
 * der JSON-Route und der Admin-Ansicht.
 */
export type LoadedReport =
  | { ok: true; data: ReportData; params: ReportParams; period: ReportPeriod; groups: Array<{ id: number; name: string }> }
  | { ok: false; error: string }

const idOf = (value: unknown): number => Number(typeof value === 'object' && value !== null ? (value as { id: unknown }).id : value)

/**
 * Geladene Daten eines Berichts. `build` baut den Bericht für alle Gruppen (ohne Angabe) oder für eine Gruppe,
 * ohne die Datenbank erneut zu fragen. Der Export ruft es je Gruppe nacheinander auf.
 */
export type ReportContext = {
  period: ReportPeriod
  params: ReportParams
  locale: string
  timeZone: string
  groups: Array<{ id: number; name: string }>
  build(group?: string): { data: ReportData; params: ReportParams }
}

export async function loadReportContext(
  payload: Payload,
  search: Record<string, string | string[] | undefined>,
  now: number = Date.now(),
): Promise<{ ok: true; context: ReportContext } | { ok: false; error: string }> {
  const settings = await payload.findGlobal({ slug: 'settings' })
  const dt = resolveDateTimeConfig(settings)
  const params = parseReportParams(search)
  const resolved = resolvePeriod({ period: params.period, from: params.from, to: params.to }, now, dt.timezone, dt.locale)
  if (!resolved.ok) return { ok: false, error: resolved.error }
  const { period, previous, months } = resolved
  // Verlauf und Wärmekarte zeigen ganze Monate: die Daten reichen bis zum Ende des letzten Monats
  const dataEnd = reportDataEnd(period, months)

  const [groupDocs, serviceDocs, eventDocs, maintenanceDocs, incidentDocs] = await Promise.all([
    payload.find({ collection: 'service-groups', sort: '_order', depth: 0, pagination: false }),
    payload.find({ collection: 'services', depth: 0, pagination: false }),
    payload.find({
      collection: 'service-status-events',
      where: { changedAt: { less_than: new Date(dataEnd).toISOString() } },
      sort: 'changedAt',
      depth: 0,
      pagination: false,
    }),
    payload.find({ collection: 'maintenances', where: { status: { not_equals: 'upcoming' } }, depth: 0, pagination: false }),
    payload.find({ collection: 'incidents', depth: 0, pagination: false }),
  ])

  const timelines = new Map<number, Timeline>()
  let firstOperationAt: number | null = null
  for (const event of eventDocs.docs) {
    const serviceId = idOf(event.service)
    const at = new Date(event.changedAt).getTime()
    const list = timelines.get(serviceId) ?? []
    list.push({ at, status: event.status })
    timelines.set(serviceId, list)
    if (event.source === 'operation' && (firstOperationAt === null || at < firstOperationAt)) firstOperationAt = at
  }

  const windows = new Map<number, Array<{ from: number; to: number }>>()
  for (const maintenance of maintenanceDocs.docs) {
    const window = maintenanceWindow(
      {
        status: maintenance.status,
        scheduledStartAt: maintenance.scheduledStartAt,
        scheduledEndAt: maintenance.scheduledEndAt,
        completedAt: maintenance.completedAt,
        cancelledAt: maintenance.cancelledAt,
        updates: (maintenance.updates || []).map((update) => ({ status: update.status, createdAt: update.createdAt })),
        serviceIds: (maintenance.affectedServices || []).map(idOf),
      },
      now,
    )
    if (!window) continue
    for (const serviceId of (maintenance.affectedServices || []).map(idOf)) {
      const list = windows.get(serviceId) ?? []
      list.push(window)
      windows.set(serviceId, list)
    }
  }

  const groups = groupDocs.docs.map((group) => ({ id: Number(group.id), name: group.name, target: group.availabilityTarget ?? null }))
  const globalTarget = settings.availabilityTarget ?? DEFAULT_AVAILABILITY_TARGET
  const services = serviceDocs.docs.map((service) => ({
    id: Number(service.id),
    name: service.name,
    groupId: idOf(service.group),
    target: service.availabilityTarget ?? null,
    timeline: timelines.get(Number(service.id)) ?? [],
    windows: windows.get(Number(service.id)) ?? [],
  }))

  // Fußnoten: Vorfälle im ganzen angezeigten Bereich (Verlauf und Zeitraum), bei gewählter Gruppe nur deren Dienste
  const buildFor = (group: string | undefined) => {
    const scoped: ReportParams = { ...params, group }
    const groupServiceIds = group
      ? serviceDocs.docs.filter((service) => String(idOf(service.group)) === group).map((service) => Number(service.id))
      : null
    const footnotes = countFootnotes(
      incidentDocs.docs.map((incident) => ({
        title: incident.title,
        messages: (incident.updates || []).map((update) => update.message),
        availabilityClass: incident.availabilityClass,
        createdAt: new Date(incident.createdAt).getTime(),
        resolvedAt: incident.resolvedAt ? new Date(incident.resolvedAt).getTime() : null,
        serviceIds: (incident.affectedServices || []).map(idOf),
      })),
      { rangeStart: Math.min(period.start, months[0]?.start ?? period.start), rangeEnd: dataEnd, firstOperationAt, groupServiceIds },
    )
    const data = buildReport({ period, previous, months, params: scoped, globalTarget, groups, services, footnotes, now, timeZone: dt.timezone, locale: dt.locale })
    return { data, scoped }
  }

  return {
    ok: true,
    context: {
      period,
      params,
      locale: dt.locale,
      timeZone: dt.timezone,
      groups: groups.map(({ id, name }) => ({ id, name })),
      build: (group) => {
        const built = buildFor(group)
        return { data: built.data, params: built.scoped }
      },
    },
  }
}

export async function loadReport(
  payload: Payload,
  search: Record<string, string | string[] | undefined>,
  now: number = Date.now(),
): Promise<LoadedReport> {
  const loaded = await loadReportContext(payload, search, now)
  if (!loaded.ok) return loaded
  const { context } = loaded
  let built = context.build(context.params.group)
  // Gruppenberichte ohne Gruppenwahl: die schwächste Gruppe ist vorgewählt
  if (context.params.view === 'groups' && !context.params.group && built.data.groupList.length > 0) {
    built = context.build(String(built.data.groupList[0].id))
  }
  return { ok: true, data: built.data, params: built.params, period: context.period, groups: context.groups }
}
