import type { RankingRow, ReportData } from '@/lib/report/aggregate'
import type { GroupSheetData } from '@/lib/report/group-sheet'

/** Gemeinsame Testdaten für die Tests des Exports. */
export const HOUR = 3_600_000
export const months = Array.from({ length: 12 }, (_, index) => ({ key: `2026-${String(index + 1).padStart(2, '0')}`, label: `Monat ${index + 1}` }))

export const rankingRow = (id: number, name: string, availability: number | null, downMs: number, extra: Partial<RankingRow> = {}): RankingRow => ({
  serviceId: id,
  name,
  groupName: 'Haushalt',
  availability,
  previousAvailability: 100,
  downMs,
  outageCount: downMs > 0 ? 1 : 0,
  longestOutageMs: downMs,
  maintenanceDownMs: 0,
  degradedMs: 0,
  maintenanceMs: 0,
  outages: downMs > 0 ? [{ from: Date.parse('2026-10-12T08:00:00Z'), to: Date.parse('2026-10-12T08:00:00Z') + downMs, status: 'partial' }] : [],
  target: 99,
  belowTarget: availability !== null && availability < 99,
  history: months.map(() => availability),
  ...extra,
})

export const emptyDays = (count: number, bars: Record<number, GroupSheetData['perDay'][number]['bars']> = {}): GroupSheetData['perDay'] =>
  Array.from({ length: count }, (_, index) => ({ day: `2026-10-${String(index + 1).padStart(2, '0')}`, dayOfMonth: index + 1, bars: bars[index + 1] ?? [] }))

export const makeReportData = (override: Partial<ReportData> = {}): ReportData => ({
  scope: { groupId: null, groupName: null, serviceCount: 2 },
  kpis: {
    availability: 99.41,
    previousAvailability: 99.5,
    downMs: 3.5 * HOUR,
    previousDownMs: 0,
    affectedServices: 1,
    serviceCount: 2,
    outageCount: 2,
    longestOutage: { ms: 2 * HOUR, serviceName: 'MACH' },
    degradedMs: 0,
    maintenanceMs: 0,
    monthsMet: 1,
    monthsTotal: 1,
    target: 99,
  },
  weakest: [rankingRow(1, 'MACH', 98.1, 3.5 * HOUR)],
  trend: months.map((month, index) => ({ ...month, availability: 99.2 + index * 0.05 })),
  heat: {
    columns: months,
    rows: [
      { name: 'Gesamt', values: months.map(() => 99.4), total: true },
      { name: 'Haushalt', values: months.map(() => 98.1) },
      { name: 'Bauen', values: months.map(() => 100) },
    ],
  },
  ranking: [rankingRow(1, 'MACH', 98.1, 3.5 * HOUR), rankingRow(2, 'Kasse', 100, 0)],
  groupList: [],
  sheet: null,
  footnotes: { unsure: 78, withoutService: 19 },
  ...override,
})
