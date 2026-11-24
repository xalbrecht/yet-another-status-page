import { isServiceActive, isServiceEnded } from '@/lib/service-lifecycle'
import type { Payload } from 'payload'
import type { Timeline } from '@/lib/availability'
import { DEFAULT_AVAILABILITY_TARGET } from '@/lib/availability'
import { resolveDateTimeConfig } from '@/lib/datetime'
import { buildGroupList, buildReport, type ReportData } from '@/lib/report/aggregate'
import { countFootnotes } from '@/lib/report/footnotes'
import { normalizeRules } from '@/lib/incident-classification'
import { maintenanceWindow } from '@/lib/report/maintenance-time'
import type { MaintenanceWindow } from '@/lib/report/metrics'
import { parseReportParams, type ReportParams } from '@/lib/report/params'
import { reportDataEnd, resolvePeriod, type ReportPeriod } from '@/lib/report/period'
import type { GroupScope } from '@/lib/roles'

/**
 * Lädt die Daten für den Verfügbarkeitsbericht und baut daraus die Berichtsdaten. Gemeinsam genutzt von
 * der JSON-Route und der Admin-Ansicht.
 */
export type LoadedReport =
  | { ok: true; data: ReportData; params: ReportParams; period: ReportPeriod }
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
  /** Kennung der schwächsten Gruppe mit Diensten, `null` ohne Gruppen. Berechnet nur die Gruppenliste, nicht den ganzen Bericht. */
  weakestGroupId(): number | null
}

/**
 * `scope` beschränkt den Bericht auf Dienstgruppen (Rolle Produktmanager): Gruppen, Dienste und Fußnoten kommen nur aus dem
 * Bereich, vor jeder Berechnung. Eine fremde Gruppe in der Adresse gilt wie eine unbekannte Gruppe. `'all'` ändert nichts.
 */
export async function loadReportContext(
  payload: Payload,
  search: Record<string, string | string[] | undefined>,
  now: number = Date.now(),
  scope: GroupScope = 'all',
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

  const windows = new Map<number, MaintenanceWindow[]>()
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
      list.push({ ...window, kind: maintenance.maintenanceKind })
      windows.set(serviceId, list)
    }
  }

  const inScope = (groupId: number): boolean => scope === 'all' || scope.includes(groupId)
  const groups = groupDocs.docs
    .filter((group) => inScope(Number(group.id)))
    .map((group) => ({ id: Number(group.id), name: group.name, target: group.availabilityTarget ?? null }))
  const globalTarget = settings.availabilityTarget ?? DEFAULT_AVAILABILITY_TARGET
  const rules = normalizeRules(settings.classificationRules)
  // Dienste im Bericht: am Berichtsdatum aktive, mit Schalter auch beendete. Dienste mit Beginn in der Zukunft nie.
  const scopedServiceDocs = serviceDocs.docs.filter((service) => inScope(idOf(service.group)))
  const reportedDocs = scopedServiceDocs.filter((service) => isServiceActive(service, now) || (params.ended && isServiceEnded(service, now)))
  const services = reportedDocs.map((service) => ({
    id: Number(service.id),
    name: service.name,
    groupId: idOf(service.group),
    target: service.availabilityTarget ?? null,
    timeline: timelines.get(Number(service.id)) ?? [],
    windows: windows.get(Number(service.id)) ?? [],
    startsAt: new Date(service.startsAt).getTime(),
    endsAt: service.endsAt ? new Date(service.endsAt).getTime() : null,
  }))

  // Fußnoten: Vorfälle im ganzen angezeigten Bereich (Verlauf und Zeitraum), bei gewählter Gruppe nur deren Dienste
  const buildFor = (group: string | undefined) => {
    const scoped: ReportParams = { ...params, group }
    // Mit Bereich zählen die Fußnoten nur Vorfälle der Dienste im Bereich, nie Vorfälle ohne Dienst oder anderer Gruppen
    const groupServiceIds = group
      ? reportedDocs.filter((service) => String(idOf(service.group)) === group).map((service) => Number(service.id))
      : scope === 'all'
        ? null
        : scopedServiceDocs.map((service) => Number(service.id))
    const footnotes = countFootnotes(
      incidentDocs.docs.map((incident) => ({
        title: incident.title,
        messages: (incident.updates || []).map((update) => update.message),
        availabilityClass: incident.availabilityClass,
        createdAt: new Date(incident.createdAt).getTime(),
        resolvedAt: incident.resolvedAt ? new Date(incident.resolvedAt).getTime() : null,
        serviceIds: (incident.affectedServices || []).map(idOf),
      })),
      { rangeStart: Math.min(period.start, months[0]?.start ?? period.start), rangeEnd: dataEnd, firstOperationAt, groupServiceIds, rules },
    )
    const data = buildReport({ period, previous, months, params: scoped, globalTarget, groups, services, footnotes, now, timeZone: dt.timezone, locale: dt.locale })
    return { data, scoped }
  }

  const weakestGroupId = (): number | null =>
    buildGroupList({ period, previous, months, params, globalTarget, groups, services, now, timeZone: dt.timezone, locale: dt.locale })[0]?.id ?? null

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
      weakestGroupId,
    },
  }
}

/**
 * Gruppenberichte ohne Gruppenwahl: die schwächste Gruppe ist vorgewählt. `weakest` wird nur gerufen, wenn die Vorgabe
 * gebraucht wird, und berechnet nur die Gruppenliste. Sonst `null`.
 */
export function defaultGroupId(params: Pick<ReportParams, 'view' | 'group'>, weakest: () => number | null): number | null {
  return params.view === 'groups' && !params.group ? weakest() : null
}

export async function loadReport(
  payload: Payload,
  search: Record<string, string | string[] | undefined>,
  now: number = Date.now(),
  scope: GroupScope = 'all',
): Promise<LoadedReport> {
  const loaded = await loadReportContext(payload, search, now, scope)
  if (!loaded.ok) return loaded
  const { context } = loaded
  const fallback = defaultGroupId(context.params, context.weakestGroupId)
  const built = context.build(fallback !== null ? String(fallback) : context.params.group)
  return { ok: true, data: built.data, params: built.params, period: context.period }
}
