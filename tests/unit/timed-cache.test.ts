import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTimedCache } from '../../src/lib/timed-cache'

// Uhr und Berechnung sind austauschbar: Der Test braucht weder Next noch eine Datenbank.
function setup() {
  let now = 1_000_000
  let calls = 0
  const cache = createTimedCache(() => now)
  const compute = async () => ({ nowMs: now, run: ++calls })
  return { cache, compute, advance: (ms: number) => (now += ms), calls: () => calls }
}

test('innerhalb der Dauer kommt der gespeicherte Stand, die Berechnung läuft einmal', async () => {
  const t = setup()
  const a = await t.cache.get('k', 60_000, t.compute)
  t.advance(59_999)
  const b = await t.cache.get('k', 60_000, t.compute)
  assert.equal(b, a)
  assert.equal(t.calls(), 1)
})

test('nach Ablauf der Dauer rechnet der nächste Aufruf neu und liefert sofort den frischen Stand (kein alter Stand)', async () => {
  const t = setup()
  const a = await t.cache.get('k', 60_000, t.compute)
  t.advance(60_001)
  const b = await t.cache.get('k', 60_000, t.compute)
  assert.notEqual(b.nowMs, a.nowMs)
  assert.equal(b.nowMs, 1_060_001)
})

test('dauerhaft kein alter Stand: auch viele Aufrufe nach Ablauf liefern nie den Stand vor dem Ablauf', async () => {
  const t = setup()
  await t.cache.get('k', 60_000, t.compute)
  for (let i = 0; i < 20; i++) {
    t.advance(30_000)
    const r = await t.cache.get('k', 60_000, t.compute)
    assert.ok(t.advance(0) - r.nowMs <= 60_000, `Stand ${i} ist älter als die Dauer`)
  }
})

test('Dauer 0 schaltet den Speicher aus', async () => {
  const t = setup()
  await t.cache.get('k', 0, t.compute)
  await t.cache.get('k', 0, t.compute)
  assert.equal(t.calls(), 2)
})

test('verschiedene Schlüssel haben getrennte Einträge', async () => {
  const t = setup()
  await t.cache.get('a', 60_000, t.compute)
  await t.cache.get('b', 60_000, t.compute)
  assert.equal(t.calls(), 2)
})

test('gleichzeitige Aufrufe teilen eine Berechnung', async () => {
  const t = setup()
  const [a, b] = await Promise.all([t.cache.get('k', 60_000, t.compute), t.cache.get('k', 60_000, t.compute)])
  assert.equal(a, b)
  assert.equal(t.calls(), 1)
})

test('clear() verwirft alle Einträge sofort', async () => {
  const t = setup()
  await t.cache.get('k', 60_000, t.compute)
  t.cache.clear()
  await t.cache.get('k', 60_000, t.compute)
  assert.equal(t.calls(), 2)
})

test('eine Berechnung, die während clear() lief, wird nicht gespeichert', async () => {
  const t = setup()
  let release!: () => void
  const slow = async () => {
    await new Promise<void>((r) => (release = r))
    return { nowMs: 1, run: 0 }
  }
  const pending = t.cache.get('k', 60_000, slow)
  t.cache.clear()
  release()
  await pending
  await t.cache.get('k', 60_000, t.compute)
  assert.equal(t.calls(), 1, 'der Stand vor clear() darf nicht überleben')
})

test('ein Fehler wird nicht gespeichert, der nächste Aufruf rechnet neu', async () => {
  const t = setup()
  await assert.rejects(t.cache.get('k', 60_000, async () => { throw new Error('x') }), /x/)
  const r = await t.cache.get('k', 60_000, t.compute)
  assert.equal(r.run, 1)
})
