import { formatTime, type DateTimeConfig } from '@/lib/datetime'

/**
 * Automatisches Neuladen der öffentlichen Seite (Issue #288). Reine Funktionen ohne Browser und ohne Payload,
 * damit Server (Einstellung, Dauer des Zwischenspeichers) und Browser (Wartezeit, Pausen) dieselben Regeln nutzen.
 */

export const AUTO_REFRESH_OPTIONS = [1, 3, 5, 10] as const
export type AutoRefreshMinutes = (typeof AUTO_REFRESH_OPTIONS)[number]

/** Kürzeste Wartezeit bis zum nächsten Neuladen. Verhindert eine enge Schleife, wenn der Stand nicht erneuert wird. */
export const AUTO_REFRESH_MIN_DELAY_MS = 5_000

/** Attribut am Wurzelelement eines offenen Fensters: solange eines im Dokument steht, lädt die Seite nicht neu. */
export const AUTO_REFRESH_PAUSE_ATTRIBUTE = 'data-auto-refresh-pause'

/** Einstellung „Seite automatisch neu laden“: Minuten, wenn eingeschaltet, sonst `null` (aus oder unbekannter Wert). */
export function parseAutoRefreshMinutes(value: unknown): AutoRefreshMinutes | null {
  const minutes = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN
  return (AUTO_REFRESH_OPTIONS as readonly number[]).includes(minutes) ? (minutes as AutoRefreshMinutes) : null
}

/**
 * Einstellung für die Dauer des Zwischenspeichers des Lagebilds: Ist das Neuladen an, gilt sein Intervall,
 * sonst das Feld „Zwischenspeicher des Lagebilds“ (oder leer: Vorgabe der Installation).
 */
export function cacheMinutesSetting(settings: { autoRefreshMinutes?: unknown; lagebildCacheMinutes?: unknown }): unknown {
  const refresh = parseAutoRefreshMinutes(settings.autoRefreshMinutes)
  return refresh === null ? settings.lagebildCacheMinutes ?? undefined : String(refresh)
}

/**
 * Wartezeit bis zum Neuladen: Rest der Zwischenspeicher-Zeit, gerechnet vom Alter des Stands bei der Auslieferung.
 * Das Alter kommt vom Server (Zeitpunkt des Aufrufs minus Stand), damit die Uhr des Browsers keine Rolle spielt.
 * Der Spielraum (`marginMs`) liegt hinter dem Ablauf, damit der erste Aufruf neu rechnet, und streut die Besucher.
 */
export function refreshDelayMs({ ageMs, minutes, marginMs }: { ageMs: number; minutes: number; marginMs: number }): number {
  const age = Number.isFinite(ageMs) && ageMs > 0 ? ageMs : 0
  return Math.max(AUTO_REFRESH_MIN_DELAY_MS, minutes * 60_000 - age + marginMs)
}

export type RefreshContext = {
  hidden: boolean
  /** Ein Fenster mit `AUTO_REFRESH_PAUSE_ATTRIBUTE` steht im Dokument. */
  dialogOpen: boolean
  /** Tagname des Elements mit Fokus, großgeschrieben. */
  focusedTag: string
  /** Das Element mit Fokus ist bearbeitbar (`contenteditable`). */
  focusedEditable: boolean
}

/** Pausiert das Neuladen: Tab unsichtbar, Fenster offen oder Eingabefeld mit Fokus. */
export function isRefreshPaused(context: RefreshContext): boolean {
  if (context.hidden || context.dialogOpen || context.focusedEditable) return true
  return context.focusedTag === 'INPUT' || context.focusedTag === 'TEXTAREA' || context.focusedTag === 'SELECT'
}

/** Angaben für die Fußzeile: Intervall, Alter des Stands bei der Auslieferung und seine Uhrzeit als Text. */
export type AutoRefreshProps = { minutes: AutoRefreshMinutes; ageMs: number; standLabel: string }

/**
 * Angaben für `Footer`, `null` bei ausgeschaltetem Neuladen. `standAt` ist der Zeitpunkt der Berechnung der ältesten Daten
 * auf der Seite (Lagebild), ohne Angabe der Aufruf: Seiten ohne Zwischenspeicher lesen ihre Daten frisch.
 */
export function autoRefreshProps(
  settings: { autoRefreshMinutes?: unknown },
  dt: DateTimeConfig,
  standAt?: number,
  servedAt: number = Date.now(),
): AutoRefreshProps | null {
  const minutes = parseAutoRefreshMinutes(settings.autoRefreshMinutes)
  if (minutes === null) return null
  const stand = standAt ?? servedAt
  return { minutes, ageMs: Math.max(0, servedAt - stand), standLabel: formatTime(new Date(stand), dt) }
}
