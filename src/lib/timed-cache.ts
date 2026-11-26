/**
 * Zwischenspeicher im Arbeitsspeicher mit fester Gültigkeitsdauer.
 *
 * Ein Eintrag gilt, solange er jünger ist als die Dauer. Danach rechnet der nächste Aufruf neu und wartet auf
 * das Ergebnis: Es gibt nie einen alten Stand „für diesmal“ (anders als `unstable_cache`, das nach Ablauf zuerst
 * den alten Wert liefert und im Hintergrund erneuert).
 *
 * - Gleichzeitige Aufrufe desselben Schlüssels teilen eine Berechnung.
 * - `clear()` verwirft alle Einträge. Eine Berechnung, die vor `clear()` begann, speichert ihr Ergebnis nicht mehr.
 * - Ein Fehler wird nicht gespeichert.
 * - Dauer 0 oder weniger schaltet den Speicher für den Aufruf aus.
 */
export interface TimedCache {
  get<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T>
  clear(): void
}

type Entry = { at: number; value: unknown }

export function createTimedCache(now: () => number = Date.now): TimedCache {
  let generation = 0
  const entries = new Map<string, Entry>()
  const running = new Map<string, Promise<unknown>>()

  return {
    async get<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
      if (ttlMs <= 0) return compute()
      const entry = entries.get(key)
      if (entry && now() - entry.at <= ttlMs) return entry.value as T
      const shared = running.get(key)
      if (shared) return shared as Promise<T>

      const startedIn = generation
      const promise = compute()
        .then((value) => {
          if (startedIn === generation) entries.set(key, { at: now(), value })
          return value
        })
        .finally(() => {
          if (running.get(key) === promise) running.delete(key)
        })
      running.set(key, promise)
      return promise
    },
    clear() {
      generation += 1
      entries.clear()
      running.clear()
    },
  }
}
