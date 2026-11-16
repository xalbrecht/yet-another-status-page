import { test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { acquireSendLockWith, SEND_LOCK_KEY } from '@/lib/report/export/send-lock'

/**
 * Die Sperre des Berichtsversands gegen eine echte PostgreSQL. Läuft nur mit gesetztem `TEST_DATABASE_URL`,
 * sonst übersprungen. Wegwerf-Datenbank starten und aufrufen, siehe docs/src/development/testing.md.
 */
const url = process.env.TEST_DATABASE_URL

test('Sperre mit PostgreSQL: zwei Pools schließen sich aus, ein Verbindungsabbruch gibt sie frei', { skip: !url, timeout: 30_000 }, async () => {
  const a = new pg.Pool({ connectionString: url, max: 3 })
  const b = new pg.Pool({ connectionString: url, max: 3 })
  b.on('error', () => undefined)
  try {
    const first = await acquireSendLockWith(a)
    assert.ok(first, 'erster Versand bekommt die Sperre')
    assert.equal(await acquireSendLockWith(b), null, 'zweiter Prozess bekommt sie nicht')
    await first.release()

    const second = await acquireSendLockWith(b)
    assert.ok(second, 'nach der Freigabe bekommt sie der andere')
    assert.equal(await acquireSendLockWith(a), null)

    // Absturz: die Verbindung des Halters wird beendet, ohne zu entsperren. Der Prozess darf dabei nicht sterben.
    await a.query('select pg_terminate_backend(pid) from pg_locks where locktype = $1 and objid = $2 and granted', ['advisory', SEND_LOCK_KEY])
    await new Promise((resolve) => setTimeout(resolve, 500))
    const third = await acquireSendLockWith(a)
    assert.ok(third, 'nach dem Verbindungsabbruch ist die Sperre frei')
    await third.release()
    await second.release()
  } finally {
    await a.end()
    await b.end()
  }
})
