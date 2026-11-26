import { createTimedCache, type TimedCache } from '@/lib/timed-cache'

/**
 * Der Speicher des Lagebilds, eine Instanz je Prozess. Er hängt an `globalThis`: Seiten und Schnittstellen sind
 * getrennte Pakete mit je eigener Modulinstanz, die Hooks der Collections (`lagebild-invalidate.ts`) und die
 * Startseite (`lagebild-cache.ts`) müssen aber denselben Speicher sehen. Eigenes Modul ohne Payload-Instanz,
 * damit die Collections keinen Zirkelbezug zur Konfiguration bekommen.
 */
const globalKey = '__yaspLagebildCache'
type WithCache = typeof globalThis & { [globalKey]?: TimedCache }

export function lagebildMemoryCache(): TimedCache {
  const holder = globalThis as WithCache
  return (holder[globalKey] ??= createTimedCache())
}
