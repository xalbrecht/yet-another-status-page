/**
 * Art einer Wartung: innerhalb des vertraglich vereinbarten Wartungsfensters (`sla`) oder zusätzlich außerhalb (`additional`).
 * Der Verfügbarkeitsbericht rechnet beide Arten getrennt (Rechenart A, B oder C je Art).
 */
export const MAINTENANCE_KINDS = ['sla', 'additional'] as const

export type MaintenanceKind = (typeof MAINTENANCE_KINDS)[number]

export function isMaintenanceKind(value: unknown): value is MaintenanceKind {
  return typeof value === 'string' && (MAINTENANCE_KINDS as readonly string[]).includes(value)
}
