import { unstable_cache } from 'next/cache'
import type { DateTimeConfig } from '@/lib/datetime'
import {
  BAR_HOURS,
  LAGEBILD_CACHE_TAG,
  PERIOD_DAYS,
  loadLagebild,
  parseCacheSeconds,
  type BarHours,
  type LagebildData,
  type PeriodDays,
} from '@/lib/lagebild'
import { getCachedPayload } from '@/lib/payload'

/**
 * Lagebild zwischenspeichern: Die Startseite rechnet je Aufruf eine Zeitleiste je Dienst und je Gruppe.
 * Das Ergebnis ist für alle Besucher gleich, es hängt nur von Rückschau, Zeitraum des Balkens, Sprache und
 * Zeitzone ab. Es gilt `LAGEBILD_CACHE_SECONDS` Sekunden (Vorgabe 60, `0` schaltet es aus). Eine Änderung am
 * Zustand eines Dienstes, an Diensten oder an Gruppen verwirft es sofort (`invalidateLagebild` in
 * `lagebild-invalidate.ts`).
 * Der Balken ist deshalb höchstens `LAGEBILD_CACHE_SECONDS` Sekunden alt.
 */
const seconds = parseCacheSeconds(process.env.LAGEBILD_CACHE_SECONDS)

// Die Funktion holt die Payload-Instanz selbst: Argumente der Funktion bilden den Schlüssel und müssen
// einfache Werte sein (Zeitzone, Sprache, Rückschau, Balken).
// `unstable_cache` verlangt `revalidate` > 0 und wirft sonst beim Laden des Moduls. Bei 0 gibt es keine.
const computeCached =
  seconds > 0
    ? unstable_cache(
        async (dt: DateTimeConfig, periodDays: PeriodDays, barHours: BarHours): Promise<LagebildData> =>
          loadLagebild(await getCachedPayload(), dt, periodDays, barHours),
        ['lagebild'],
        { revalidate: seconds, tags: [LAGEBILD_CACHE_TAG] },
      )
    : null

export async function loadLagebildCached(
  dt: DateTimeConfig,
  periodDays: PeriodDays = PERIOD_DAYS,
  barHours: BarHours = BAR_HOURS,
): Promise<LagebildData> {
  if (!computeCached) return loadLagebild(await getCachedPayload(), dt, periodDays, barHours)
  return computeCached(dt, periodDays, barHours)
}
