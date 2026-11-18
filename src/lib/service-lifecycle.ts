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

/** Zustandsfilter der Dienstliste im Admin. `null` heißt kein Zustandsfilter (alle Dienste). */
export type ServiceState = 'active' | 'ended' | 'not-started'

type Leaf = { field: string; operator: string }
type WhereLike = Record<string, unknown>

const isRecord = (value: unknown): value is WhereLike => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Die Bedingungen einer Abfrage als Liste: Einträge von `and`, übrige Felder auf oberster Ebene als ein Eintrag davor. */
function entriesOf(where: Where | undefined): WhereLike[] {
  if (!isRecord(where)) return []
  const { and, ...rest } = where as WhereLike
  return [...(Object.keys(rest).length > 0 ? [rest] : []), ...(Array.isArray(and) ? and.filter(isRecord) : [])]
}

/** Blätter eines Eintrags (Feld und Operator), ohne die Werte: nach dem Weg durch die Adresszeile sind Werte Texte. */
function leavesOf(entry: WhereLike): Leaf[] | null {
  const leaves: Leaf[] = []
  const visit = (node: WhereLike): boolean => {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'or' || key === 'and') {
        if (!Array.isArray(value)) return false
        for (const child of value) if (!isRecord(child) || !visit(child)) return false
      } else if (isRecord(value)) {
        for (const operator of Object.keys(value)) leaves.push({ field: key, operator })
      } else return false
    }
    return true
  }
  return visit(entry) ? leaves : null
}

const signatureOf = (entry: WhereLike): string | null => {
  const leaves = leavesOf(entry)
  return leaves ? leaves.map((leaf) => `${leaf.field}.${leaf.operator}`).sort().join('|') : null
}

// Bedingungen im Format des Filters von Payload (`and` aus `or`-Gruppen), damit der eingebaute Filter sie anzeigen kann.
const START_REACHED = 'startsAt.less_than_equal'
const END_OPEN_OR_LATER = 'endsAt.exists|endsAt.greater_than_equal'
const ENDED = 'endsAt.less_than'
const NOT_STARTED = 'startsAt.greater_than'

/** Bedingungen (Einträge von `and`) für einen Zustand zum Zeitpunkt `at`. Entspricht `isServiceActive`, `isServiceEnded` und `isServiceNotStarted`. */
export function serviceStateConditions(state: ServiceState, at: number): Where[] {
  const iso = new Date(at).toISOString()
  if (state === 'ended') return [{ or: [{ endsAt: { less_than: iso } }] }]
  if (state === 'not-started') return [{ or: [{ startsAt: { greater_than: iso } }] }]
  return [
    { or: [{ startsAt: { less_than_equal: iso } }] },
    { or: [{ endsAt: { exists: false } }, { endsAt: { greater_than_equal: iso } }] },
  ]
}

/** Welcher Zustandsfilter steckt in der Abfrage? Erkannt an Feldern und Operatoren, nicht an den Werten. */
export function detectServiceState(where: Where | undefined): ServiceState | null {
  const signatures = new Set(entriesOf(where).map(signatureOf))
  if (signatures.has(START_REACHED) && signatures.has(END_OPEN_OR_LATER)) return 'active'
  if (signatures.has(ENDED)) return 'ended'
  if (signatures.has(NOT_STARTED)) return 'not-started'
  return null
}

/**
 * Setzt den Zustandsfilter in die Abfrage und lässt alle anderen Bedingungen unverändert. Ein vorhandener Zustandsfilter
 * wird ersetzt, `null` entfernt ihn. Ohne Bedingungen ergibt sich `undefined`.
 */
export function applyServiceState(where: Where | undefined, state: ServiceState | null, at: number): Where | undefined {
  const stateSignatures = new Set([START_REACHED, END_OPEN_OR_LATER, ENDED, NOT_STARTED])
  const others = entriesOf(where).filter((entry) => {
    const signature = signatureOf(entry)
    return signature === null || !stateSignatures.has(signature)
  })
  const entries = [...others, ...(state === null ? [] : serviceStateConditions(state, at))]
  return entries.length === 0 ? undefined : ({ and: entries } as Where)
}
