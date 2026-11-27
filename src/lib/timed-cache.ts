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
  /**
   * Wie `get`, dazu der Beginn der Berechnung (bei Dauer 0: der Aufruf). Die Werte wurden nach diesem Zeitpunkt gelesen,
   * der Wert ist also nicht älter. Die Dauer rechnet ab demselben Zeitpunkt.
   */
  getEntry<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<{ value: T; at: number }>
  clear(): void
}

type Entry = { at: number; value: unknown }

export function createTimedCache(now: () => number = Date.now): TimedCache {
  let generation = 0
  const entries = new Map<string, Entry>()
  const running = new Map<string, Promise<Entry>>()

  async function getEntry<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<{ value: T; at: number }> {
    if (ttlMs <= 0) {
      const at = now()
      return { value: await compute(), at }
    }
    const entry = entries.get(key)
    if (entry && now() - entry.at <= ttlMs) return entry as { value: T; at: number }
    const shared = running.get(key)
    if (shared) return shared as Promise<{ value: T; at: number }>

    const startedIn = generation
    const startedAt = now()
    const promise: Promise<Entry> = compute()
      .then((value) => {
        const fresh = { at: startedAt, value }
        if (startedIn === generation) entries.set(key, fresh)
        return fresh
      })
      .finally(() => {
        if (running.get(key) === promise) running.delete(key)
      })
    running.set(key, promise)
    return promise as Promise<{ value: T; at: number }>
  }

  return {
    async get<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
      return (await getEntry(key, ttlMs, compute)).value
    },
    getEntry,
    clear() {
      generation += 1
      entries.clear()
      running.clear()
    },
  }
}
