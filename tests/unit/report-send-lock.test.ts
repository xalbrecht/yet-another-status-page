import { test } from 'node:test'
import assert from 'node:assert/strict'
import { acquireSendLockWith, SEND_LOCK_KEY, type LockPool } from '@/lib/report/export/send-lock'

// Pool-Attrappe: Die Sperre gehört dem, der sie zuerst bekommt, wie bei pg_try_advisory_lock
function fakePool(options: { failUnlock?: boolean; failLock?: boolean } = {}) {
  const log: string[] = []
  let held = false
  const pool: LockPool = {
    async connect() {
      return {
        async query(text: string, values?: unknown[]) {
          assert.deepEqual(values, [SEND_LOCK_KEY])
          if (text.includes('pg_try_advisory_lock')) {
            if (options.failLock) throw new Error('Datenbank nicht erreichbar')
            const got = !held
            held = true
            log.push(got ? 'lock' : 'lock-belegt')
            return { rows: [{ locked: got }] }
          }
          if (options.failUnlock) throw new Error('Verbindung weg')
          held = false
          log.push('unlock')
          return { rows: [{}] }
        },
        release(destroy?: boolean) {
          log.push(destroy ? 'release-destroy' : 'release')
        },
        on(event: 'error') {
          log.push(`on-${event}`)
        },
        off(event: 'error') {
          log.push(`off-${event}`)
        },
      }
    },
  }
  return { pool, log }
}

test('der zweite Versand bekommt die Sperre nicht, nach dem Freigeben wieder', async () => {
  const { pool, log } = fakePool()
  const first = await acquireSendLockWith(pool)
  assert.ok(first)
  assert.equal(await acquireSendLockWith(pool), null)
  await first.release()
  const third = await acquireSendLockWith(pool)
  assert.ok(third)
  assert.deepEqual(log, ['on-error', 'lock', 'on-error', 'lock-belegt', 'off-error', 'release', 'unlock', 'off-error', 'release', 'on-error', 'lock'])
})

test('misslingt das Entsperren, wird die Verbindung geschlossen (die Datenbank löst die Sperre)', async () => {
  const { pool, log } = fakePool({ failUnlock: true })
  const lock = await acquireSendLockWith(pool)
  await lock!.release()
  assert.deepEqual(log, ['on-error', 'lock', 'off-error', 'release-destroy'])
})

test('Fehler bei der Sperre: Verbindung wird geschlossen und der Fehler weitergegeben', async () => {
  const { pool, log } = fakePool({ failLock: true })
  await assert.rejects(() => acquireSendLockWith(pool), /nicht erreichbar/)
  assert.deepEqual(log, ['on-error', 'off-error', 'release-destroy'])
})

test('der Client bekommt einen Fehler-Handler, solange die Sperre gehalten wird (Verbindungsabbruch stürzt den Prozess nicht ab)', async () => {
  const { pool, log } = fakePool()
  const lock = await acquireSendLockWith(pool)
  assert.equal(log.at(0), 'on-error')
  assert.ok(!log.includes('off-error'), 'der Handler bleibt bis zur Freigabe')
  await lock!.release()
  assert.ok(log.indexOf('off-error') > log.indexOf('unlock'))
})
