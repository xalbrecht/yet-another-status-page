/**
 * Lebenszyklus eines Dienstes: Beginn und Ende bestimmen, ob er aktiv ist.
 * „Aktiv“ wird nie gespeichert, sondern bei jedem Lesen aus den beiden Daten berechnet.
 *
 * Beginn ist der Beginn des Tages, Ende das Ende des Tages (der Endtag zählt noch mit).
 * Die Felder speichern diese Zeitpunkte, die Hilfe vergleicht sie nur.
 *
 * Nur datetime.ts als Abhängigkeit, damit auch Dateien sie nutzen können, die im Browser laufen.
 */
import type { Where } from 'payload'
import { endOfZonedDay, startOfZonedDay } from '@/lib/datetime'

export type LifecycleFields = {
  startsAt: string | number | Date
  endsAt?: string | number | Date | null
}

const toMs = (value: string | number | Date): number => (value instanceof Date ? value.getTime() : new Date(value).getTime())

/** Aktiv: Beginn erreicht und das Ende leer oder noch nicht überschritten. */
export function isServiceActive(service: LifecycleFields, at: number): boolean {
  if (toMs(service.startsAt) > at) return false
  return service.endsAt == null || at <= toMs(service.endsAt)
}

/** Beendet: ein Ende ist gesetzt und überschritten. */
export function isServiceEnded(service: LifecycleFields, at: number): boolean {
  return service.endsAt != null && at > toMs(service.endsAt)
}

/** Der Beginn liegt noch in der Zukunft. */
export function isServiceNotStarted(service: LifecycleFields, at: number): boolean {
  return toMs(service.startsAt) > at
}

/** Ende vor dem Beginn ist ungültig, der gleiche Tag ist erlaubt. */
export function endsAtBeforeStart(
  startsAt: string | number | Date,
  endsAt: string | number | Date | null | undefined,
): boolean {
  return endsAt != null && toMs(endsAt) < toMs(startsAt)
}

/** Abfragefilter (Payload) für Dienste, die zum Zeitpunkt `at` aktiv sind. Entspricht `isServiceActive`. */
export function activeServiceWhere(at: number): Where {
  const iso = new Date(at).toISOString()
  return {
    and: [
      { startsAt: { less_than_equal: iso } },
      { or: [{ endsAt: { exists: false } }, { endsAt: { greater_than_equal: iso } }] },
    ],
  }
}

/**
 * Tagesgrenze für die Eingabe als Tag: `start` ist der Tagesanfang (Beginn), `end` das Tagesende (Ende, der Endtag zählt mit).
 * Der Kalendertag ist der Tag von `picked` in der Zeitzone der Installation.
 */
export function dayBoundary(picked: Date, edge: 'start' | 'end', timeZone: string): Date {
  return edge === 'start' ? startOfZonedDay(picked, timeZone) : endOfZonedDay(picked, timeZone)
}

/** Löschen ist nur nach dem Ende erlaubt: ein Ende ist gesetzt und überschritten. */
export function canDeleteService(
  service: LifecycleFields,
  at: number,
): { ok: true } | { ok: false; reason: 'active' | 'ends-in-future' } {
  if (service.endsAt == null) return { ok: false, reason: 'active' }
  return isServiceEnded(service, at) ? { ok: true } : { ok: false, reason: 'ends-in-future' }
}

/** Wie `activeServiceWhere`, für den Zeitpunkt der Abfrage. Für Seiten und Server-Komponenten (kein `Date.now()` im Rendern). */
export function activeServiceWhereNow(): Where {
  return activeServiceWhere(Date.now())
}
