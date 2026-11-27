import { translatorsFor } from '@/lib/i18n/translators'
import type { DateTimeConfig } from '@/lib/datetime'
import {
  BAR_HOURS,
  PERIOD_DAYS,
  cacheSecondsFromSetting,
  lagebildCacheKey,
  loadLagebild,
  parseCacheSeconds,
  type BarHours,
  type LagebildData,
  type PeriodDays,
} from '@/lib/lagebild'
import { getCachedPayload } from '@/lib/payload'
import { lagebildMemoryCache } from '@/lib/lagebild-memory'

/**
 * Lagebild zwischenspeichern: Die Startseite rechnet je Aufruf eine Zeitleiste je Dienst und je Gruppe.
 * Das Ergebnis ist für alle Besucher gleich, es hängt nur von Rückschau, Zeitraum des Balkens, Sprache und
 * Zeitzone ab. Es gilt so viele Sekunden, wie die Einstellung „Zwischenspeicher des Lagebilds“ sagt, ersatzweise
 * `LAGEBILD_CACHE_SECONDS` (Vorgabe 60, `0` schaltet es aus). Eine Änderung am Zustand eines Dienstes, an Diensten
 * oder an Gruppen verwirft es sofort (`invalidateLagebild` in `lagebild-invalidate.ts`).
 * Der Balken ist deshalb höchstens so alt wie die Dauer. Nach Ablauf rechnet der nächste Aufruf neu und wartet darauf
 * (siehe `timed-cache.ts`; `unstable_cache` lieferte in einer laufenden Instanz dauerhaft den alten Stand, Issue #284).
 * Ist das automatische Neuladen an, gilt sein Intervall als Dauer (`cacheMinutesSetting` in `auto-refresh.ts`). */
const envSeconds = parseCacheSeconds(process.env.LAGEBILD_CACHE_SECONDS)

export async function loadLagebildCached(
  language: string,
  dt: DateTimeConfig,
  periodDays: PeriodDays = PERIOD_DAYS,
  barHours: BarHours = BAR_HOURS,
  cacheMinutesSetting?: unknown,
): Promise<{ data: LagebildData; computedAt: number }> {
  const seconds = cacheSecondsFromSetting(cacheMinutesSetting, envSeconds)
  const compute = async () => loadLagebild(await getCachedPayload(), dt, translatorsFor(language), periodDays, barHours)
  const key = JSON.stringify([...lagebildCacheKey(language), dt, periodDays, barHours])
  const entry = await lagebildMemoryCache().getEntry(key, seconds * 1000, compute)
  // `computedAt` ist der Stand der Seite: Kein Wert des Lagebilds ist älter (Issue #288)
  return { data: entry.value, computedAt: entry.at }
}
