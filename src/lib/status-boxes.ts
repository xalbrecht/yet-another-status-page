/**
 * Boxen „Aktuelle Störungen“ und „Wartungen“ der Statusseite (Kurzform).
 * Dieses Modul bereitet die Daten auf, die Darstellung steht in `components/status/StatusBoxes.tsx`.
 */
import { formatDateTime, type DateTimeConfig } from '@/lib/datetime'
import { t, tf, type TranslationKey } from '@/lib/i18n'
import type { LagebildStatus } from '@/lib/lagebild'

export type BoxContent = 'full' | 'compact'
export type BoxesPlacement = 'before' | 'after'

export const BOX_ENTRIES_DEFAULT = 3
export const BOX_ENTRIES_MIN = 1
export const BOX_ENTRIES_MAX = 10

export function parseBoxEntries(value: unknown): number {
  const n = Math.trunc(Number(value))
  if (!Number.isFinite(n) || n === 0) return BOX_ENTRIES_DEFAULT
  return Math.min(BOX_ENTRIES_MAX, Math.max(BOX_ENTRIES_MIN, n))
}

export function parseBoxContent(value: unknown): BoxContent {
  return value === 'compact' ? 'compact' : 'full'
}

export function parseBoxesPlacement(value: unknown): BoxesPlacement {
  return value === 'after' ? 'after' : 'before'
}

export type BoxItem = {
  id: string
  href: string
  title: string
  status: LagebildStatus
  stateLabel: string
  when: string
  services: string[]
  last: string | null
}

type ServiceRef = number | { id?: number | string; name?: string | null } | null | undefined
type BoxUpdate = { status?: string | null; message?: string | null; createdAt?: string | null }

/** Strukturelle Teilmenge von `Incident`. */
export type BoxIncident = {
  id: number | string
  shortId?: string | null
  title: string
  impact: 'degraded' | 'partial' | 'major'
  createdAt?: string | null
  updates?: BoxUpdate[] | null
  affectedServices?: ServiceRef[] | null
}

/** Strukturelle Teilmenge von `Maintenance`. */
export type BoxMaintenance = {
  id: number | string
  shortId?: string | null
  title: string
  status: 'upcoming' | 'in_progress' | 'completed' | 'cancelled'
  scheduledStartAt: string
  scheduledEndAt?: string | null
  updates?: BoxUpdate[] | null
  affectedServices?: ServiceRef[] | null
}

export function limitBoxItems<T>(items: T[], limit: number): { shown: T[]; more: number } {
  const shown = items.slice(0, limit)
  return { shown, more: items.length - shown.length }
}

/** Dienste als Namen. Nicht aufgelöste Verweise (nur Ids) entfallen. */
function serviceNames(services: ServiceRef[] | null | undefined): string[] {
  const names: string[] = []
  for (const service of services ?? []) {
    if (typeof service === 'object' && service !== null && service.name) names.push(service.name)
  }
  return names
}

/** Der neueste Eintrag steht am Ende des Feldes (Reihenfolge der Anlage). */
function latestUpdate(updates: BoxUpdate[] | null | undefined): BoxUpdate | undefined {
  return updates && updates.length > 0 ? updates[updates.length - 1] : undefined
}

function lastMessage(updates: BoxUpdate[] | null | undefined): string | null {
  const message = latestUpdate(updates)?.message
  return message ? message : null
}

export function buildIncidentItems(incidents: BoxIncident[], dt: DateTimeConfig): BoxItem[] {
  const items: BoxItem[] = []
  for (const incident of incidents) {
    const status = latestUpdate(incident.updates)?.status || 'investigating'
    if (status === 'resolved') continue
    const started = incident.createdAt ?? incident.updates?.[0]?.createdAt
    items.push({
      id: String(incident.id),
      href: `/i/${incident.shortId ?? ''}`,
      title: incident.title,
      status: incident.impact,
      stateLabel: t(`incident.${status}` as TranslationKey),
      when: started ? formatDateTime(new Date(started), dt) : '',
      services: serviceNames(incident.affectedServices),
      last: lastMessage(incident.updates),
    })
  }
  return items
}

export function buildMaintenanceItems(maintenances: BoxMaintenance[], dt: DateTimeConfig): BoxItem[] {
  return maintenances
    .filter((m) => m.status === 'upcoming' || m.status === 'in_progress')
    .sort((a, b) => new Date(a.scheduledStartAt).getTime() - new Date(b.scheduledStartAt).getTime())
    .map((m) => {
      const start = formatDateTime(new Date(m.scheduledStartAt), dt)
      const end = m.scheduledEndAt ? formatDateTime(new Date(m.scheduledEndAt), dt) : null
      return {
        id: String(m.id),
        href: `/m/${m.shortId ?? ''}`,
        title: m.title,
        status: 'maintenance',
        stateLabel: t(`maintenance.${m.status}` as TranslationKey),
        when: end === null ? tf('maintenance.noticeSoonOpen', { start }) : tf('maintenance.noticeSoon', { start, end }),
        services: serviceNames(m.affectedServices),
        last: lastMessage(m.updates),
      }
    })
}
