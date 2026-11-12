import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rebuildStatusLog, type SqlRunner } from '@/lib/status-log-rebuild'

/** Ein Lauf-Ersatz, der festhält, über welches Objekt jede Anweisung lief. */
function fakeDb(options: { throwOnTx?: boolean } = {}) {
  const calls: Array<'db' | 'tx'> = []
  let reads = 0
  const rows = (kind: 'db' | 'tx') => async () => {
    calls.push(kind)
    if (kind === 'tx' && options.throwOnTx) throw new Error('Schreibfehler')
    if (kind === 'db') reads++
    // erste Abfrage: Vorfälle (keine), zweite: Anzahl der nachgerechneten Zeilen
    return { rows: kind === 'db' && reads === 2 ? [{ n: 0 }] : [] }
  }
  const db: SqlRunner & { transaction: <T>(fn: (tx: SqlRunner) => Promise<T>) => Promise<T> } = {
    execute: rows('db'),
    transaction: async (fn) => fn({ execute: rows('tx') }),
  }
  return { db, calls }
}

test('Löschen und Einfügen laufen in einer Transaktion, das Lesen außerhalb', async () => {
  const { db, calls } = fakeDb()
  await rebuildStatusLog(db, { dryRun: false })
  assert.deepEqual(calls.filter((call) => call === 'tx'), ['tx'])
  assert.ok(calls.filter((call) => call === 'db').length >= 2)
})

test('die Vorschau schreibt nichts und öffnet keine Transaktion', async () => {
  const { db, calls } = fakeDb()
  await rebuildStatusLog(db, { dryRun: true })
  assert.equal(calls.includes('tx'), false)
})

test('ein Schreibfehler wird weitergegeben', async () => {
  const { db } = fakeDb({ throwOnTx: true })
  await assert.rejects(() => rebuildStatusLog(db, { dryRun: false }), /Schreibfehler/)
})
