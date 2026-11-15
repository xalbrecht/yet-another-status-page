import type { Payload } from 'payload'

/**
 * Sperre gegen gleichzeitige Versände des Berichts (Issue #116). Rendern und Anhänge brauchen viel Speicher, zwei Versände
 * zugleich überschreiten das Limit. Die Sperre ist eine Advisory Lock von PostgreSQL auf einer eigenen Verbindung: sie gilt
 * für alle Prozesse und Replikate und fällt von selbst weg, wenn der Prozess abstürzt (die Verbindung bricht ab).
 */

/** Beliebige, feste Kennung der Sperre (nur für diese Funktion vergeben). */
export const SEND_LOCK_KEY = 7_116_001

type LockClient = {
  query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>
  release(destroy?: boolean): void
  /** Ereignisse der Verbindung (pg): ohne Handler beendet ein Verbindungsabbruch den Prozess */
  on?(event: 'error', handler: (error: Error) => void): unknown
  off?(event: 'error', handler: (error: Error) => void): unknown
}
export type LockPool = { connect(): Promise<LockClient> }

export type SendLock = { release(): Promise<void> }

/** `null`, wenn ein anderer Versand die Sperre hält. */
export async function acquireSendLockWith(pool: LockPool): Promise<SendLock | null> {
  const client = await pool.connect()
  // Bricht die Verbindung ab (Datenbank neu gestartet, Sitzung beendet), meldet pg das als Fehler am Client. Der Abbruch
  // gibt die Sperre frei; der Versand selbst läuft über andere Verbindungen weiter. Der Handler verhindert den Absturz.
  const ignoreConnectionError = () => undefined
  client.on?.('error', ignoreConnectionError)
  const done = (destroy?: boolean) => {
    client.off?.('error', ignoreConnectionError)
    client.release(destroy)
  }
  let locked = false
  try {
    const result = await client.query('select pg_try_advisory_lock($1) as locked', [SEND_LOCK_KEY])
    locked = result.rows[0]?.locked === true
  } catch (error) {
    done(true)
    throw error
  }
  if (!locked) {
    done()
    return null
  }
  return {
    async release() {
      try {
        await client.query('select pg_advisory_unlock($1)', [SEND_LOCK_KEY])
        done()
      } catch {
        // Entsperren misslungen: die Verbindung schließen, damit die Datenbank die Sperre löst
        done(true)
      }
    },
  }
}

/** Sperre über den Verbindungspool von Payload (PostgreSQL). */
export async function acquireSendLock(payload: Payload): Promise<SendLock | null> {
  const pool = (payload.db as unknown as { pool?: LockPool }).pool
  if (!pool) throw new Error('Kein PostgreSQL-Pool am Datenbankadapter gefunden')
  return acquireSendLockWith(pool)
}
