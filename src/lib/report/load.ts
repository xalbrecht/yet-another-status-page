import type { Payload } from 'payload'
import type { Timeline } from '@/lib/availability'
import { DEFAULT_AVAILABILITY_TARGET } from '@/lib/availability'
import { resolveDateTimeConfig } from '@/lib/datetime'
import { classifyIncident } from '@/lib/incident-classification'
import { buildReport, type ReportData } from '@/lib/report/aggregate'
import { maintenanceWindow } from '@/lib/report/maintenance-time'
import { parseReportParams, type ReportParams } from '@/lib/report/params'
import { resolvePeriod, type ReportPeriod } from '@/lib/report/period'

/**
 * Lädt die Daten für den Verfügbarkeitsbericht und baut daraus die Berichtsdaten (Konzept 6). Gemeinsam genutzt von
 * der JSON-Route und der Admin-Ansicht.
 */
export type LoadedReport =
  | { ok: true; data: ReportData; params: ReportParams; period: ReportPeriod; groups: Array<{ id: number; name: string }> }
  | { ok: false; error: string }

const idOf = (value: unknown): number => Number(typeof value === 'object' && value !== null ? (value as { id: unknown }).id : value)

export async function loadReport(
  payload: Payload,
  search: Record<string, string | string[] | undefined>,
  now: number = Date.now(),
): Promise<LoadedReport> {
  const settings = await payload.findGlobal({ slug: 'settings' })
  const dt = resolveDateTimeConfig(settings)
  const params = parseReportParams(search)
  const resolved = resolvePeriod({ period: params.period, from: params.from, to: params.to }, now, dt.timezone, dt.locale)
  if (!resolved.ok) return { ok: false, error: resolved.error }
  const { period, previous, months } = resolved

  const [groupDocs, serviceDocs, eventDocs, maintenanceDocs, incidentDocs] = await Promise.all([
    payload.find({ collection: 'service-groups', sort: '_order', depth: 0, pagination: false }),
    payload.find({ collection: 'services', depth: 0, pagination: false }),
    payload.find({
      collection: 'service-status-events',
      where: { changedAt: { less_than: new Date(period.end).toISOString() } },
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

  // Fußnoten: Vorfälle im Zeitraum vor dem ersten Betriebseintrag, deren Einordnung nicht eindeutig ist oder die keinen Dienst haben
  let unsure = 0
  let withoutService = 0
  for (const incident of incidentDocs.docs) {
    const from = new Date(incident.createdAt).getTime()
    const to = incident.resolvedAt ? new Date(incident.resolvedAt).getTime() : Number.POSITIVE_INFINITY
    if (firstOperationAt !== null && from >= firstOperationAt) continue
    if (from >= period.end || to <= period.start) continue
    const serviceCount = (incident.affectedServices || []).length
    if (serviceCount === 0) {
      withoutService++
      continue
    }
    const result = classifyIncident({
      title: incident.title,
      messages: (incident.updates || []).map((update) => update.message),
      availabilityClass: incident.availabilityClass,
    })
    if (!result.sure) unsure++
  }

  const groups = groupDocs.docs.map((group) => ({ id: Number(group.id), name: group.name, target: group.availabilityTarget ?? null }))
  const data = buildReport({
    period,
    previous,
    months,
    params,
    globalTarget: settings.availabilityTarget ?? DEFAULT_AVAILABILITY_TARGET,
    groups,
    services: serviceDocs.docs.map((service) => ({
      id: Number(service.id),
      name: service.name,
      groupId: idOf(service.group),
      target: service.availabilityTarget ?? null,
      timeline: timelines.get(Number(service.id)) ?? [],
      windows: windows.get(Number(service.id)) ?? [],
    })),
    footnotes: { unsure, withoutService },
    now,
    timeZone: dt.timezone,
    locale: dt.locale,
  })
  return { ok: true, data, params, period, groups: groups.map(({ id, name }) => ({ id, name })) }
}
