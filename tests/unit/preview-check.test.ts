import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import { assertPreviewMatches, fingerprintOf, parseExpected, previewChangedMessage, PreviewChangedError } from '@/lib/preview-check'
import { rebuildStatusLog, type SqlRunner } from '@/lib/status-log-rebuild'
import { convertMaintenanceIncidents } from '@/lib/maintenance-conversion'

// ── Bausteine ────────────────────────────────────────────────────────────────

test('der Hash ist für gleichen Inhalt gleich und für anderen verschieden', () => {
  assert.equal(fingerprintOf({ a: [1, 2] }), fingerprintOf({ a: [1, 2] }))
  assert.notEqual(fingerprintOf({ a: [1, 2] }), fingerprintOf({ a: [1, 3] }))
})

test('ohne Erwartung wird nichts geprüft, mit gleicher Erwartung ebenso, mit abweichender wird geworfen', () => {
  const actual = { count: 17, fingerprint: 'x' }
  assert.doesNotThrow(() => assertPreviewMatches(undefined, actual))
  assert.doesNotThrow(() => assertPreviewMatches({ count: 17, fingerprint: 'x' }, actual))
  assert.throws(() => assertPreviewMatches({ count: 17, fingerprint: 'y' }, actual), PreviewChangedError)
})

test('parseExpected nimmt nur Zahl und Hash an', () => {
  assert.deepEqual(parseExpected({ count: 3, fingerprint: 'abc', extra: 1 }), { count: 3, fingerprint: 'abc' })
  for (const bad of [undefined, null, 'x', {}, { count: '3', fingerprint: 'abc' }, { count: 3, fingerprint: '' }, { count: NaN, fingerprint: 'a' }]) {
    assert.equal(parseExpected(bad), undefined)
  }
})

test('die Meldung nennt beide Zahlen, bei gleicher Zahl aber anderem Inhalt keine', () => {
  const english = (text: string) => text
  const changed = new PreviewChangedError({ count: 17, fingerprint: 'a' }, { count: 20, fingerprint: 'b' })
  assert.equal(
    previewChangedMessage(changed, english),
    'Since the preview the numbers changed (preview: 17, now: 20). Please run the preview again.',
  )
  const sameCount = new PreviewChangedError({ count: 17, fingerprint: 'a' }, { count: 17, fingerprint: 'b' })
  assert.equal(previewChangedMessage(sameCount, english), 'Since the preview the data changed. Please run the preview again.')
})

// ── Nachrechnung des Statusprotokolls ────────────────────────────────────────

type IncidentRow = { id: number; title: string; availability_class: string | null; from_ms: number; to_ms: number | null; service_ids: number[]; messages: string[] }
const row = (id: number, overrides: Partial<IncidentRow> = {}): IncidentRow => ({
  id,
  title: `Ausfall ${id}`,
  availability_class: 'major',
  from_ms: 1_700_000_000_000 + id * 86_400_000,
  to_ms: 1_700_000_000_000 + id * 86_400_000 + 3_600_000,
  service_ids: [1],
  messages: [],
  ...overrides,
})

/** Lauf-Ersatz in der Reihenfolge der Abfragen: Vorfälle, Zahl der nachgerechneten Einträge, Dienste. */
function rebuildDb(incidents: IncidentRow[]) {
  const writes: string[] = []
  let reads = 0
  const db: SqlRunner = {
    execute: async () => {
      reads++
      if (reads === 1) return { rows: incidents }
      if (reads === 2) return { rows: [{ n: 5 }] }
      return { rows: [{ id: 1, first_ms: null }] }
    },
    transaction: async (fn) => fn({ execute: async () => { writes.push('write'); return { rows: [] } } }),
  }
  return { db, writes }
}

test('Nachrechnung: die Vorschau liefert Zahl und Hash der Vorfälle', async () => {
  const { db } = rebuildDb([row(1), row(2)])
  const preview = await rebuildStatusLog(db, { dryRun: true })
  assert.equal(preview.check.count, 2)
  assert.match(preview.check.fingerprint, /^[0-9a-f]{16}$/)
})

test('Nachrechnung: unveränderter Bestand läuft mit der Erwartung der Vorschau', async () => {
  const preview = await rebuildStatusLog(rebuildDb([row(1), row(2)]).db, { dryRun: true })
  const { db, writes } = rebuildDb([row(1), row(2)])
  const run = await rebuildStatusLog(db, { dryRun: false, expect: preview.check })
  assert.equal(run.dryRun, false)
  assert.ok(writes.length > 0, 'es wurde geschrieben')
})

test('Nachrechnung: die Reihenfolge der Vorfälle ändert den Hash nicht', async () => {
  const a = await rebuildStatusLog(rebuildDb([row(1), row(2), row(3)]).db, { dryRun: true })
  const b = await rebuildStatusLog(rebuildDb([row(3), row(1), row(2)]).db, { dryRun: true })
  assert.equal(a.check.fingerprint, b.check.fingerprint)
})

test('Nachrechnung: hat sich die Zahl der Vorfälle geändert, wird nichts geschrieben und die Zahlen stehen im Fehler', async () => {
  const preview = await rebuildStatusLog(rebuildDb([row(1), row(2)]).db, { dryRun: true })
  const { db, writes } = rebuildDb([row(1), row(2), row(3)])
  await assert.rejects(
    () => rebuildStatusLog(db, { dryRun: false, expect: preview.check }),
    (error: unknown) => error instanceof PreviewChangedError && error.expected.count === 2 && error.actual.count === 3,
  )
  assert.deepEqual(writes, [])
})

test('Nachrechnung: gleiche Zahl, aber andere Einordnung eines Vorfalls, wird abgelehnt', async () => {
  const preview = await rebuildStatusLog(rebuildDb([row(1), row(2)]).db, { dryRun: true })
  const { db, writes } = rebuildDb([row(1), row(2, { availability_class: 'degraded' })])
  await assert.rejects(() => rebuildStatusLog(db, { dryRun: false, expect: preview.check }), PreviewChangedError)
  assert.deepEqual(writes, [])
})

// ── Wartungen aus Störungen ──────────────────────────────────────────────────

const rules = [{ field: 'title', match: 'contains', words: 'wartung', classification: 'maintenance' }] as const
const incident = (id: number) => ({
  id,
  title: `Wartung von Dienst ${id}`,
  shortId: `s${id}`,
  createdAt: '2026-10-12T18:00:00.000Z',
  resolvedAt: '2026-10-12T20:10:00.000Z',
  availabilityClass: 'auto',
  affectedServices: [7],
  updates: [{ status: 'resolved', message: 'fertig', createdAt: '2026-10-12T20:10:00.000Z' }],
})

function conversionPayload(incidents: Array<ReturnType<typeof incident>>) {
  const calls: string[] = []
  const payload = {
    find: async ({ collection }: { collection: string }) => ({ docs: collection === 'incidents' ? incidents : [] }),
    create: async () => { calls.push('create'); return {} },
    delete: async () => { calls.push('delete'); return {} },
    db: { drizzle: { execute: async () => ({ rows: [] }) } },
  } as unknown as Payload
  return { payload, calls }
}

test('Umwandlung: die Vorschau liefert Zahl und Hash und ändert nichts', async () => {
  const { payload, calls } = conversionPayload([incident(1), incident(2)])
  const preview = await convertMaintenanceIncidents(payload, { dryRun: true, rules: [...rules] })
  assert.equal(preview.check.count, 2)
  assert.equal(preview.converted.length, 2)
  assert.deepEqual(calls, [])
})

test('Umwandlung: unveränderter Bestand läuft mit der Erwartung der Vorschau', async () => {
  const preview = await convertMaintenanceIncidents(conversionPayload([incident(1), incident(2)]).payload, { dryRun: true, rules: [...rules] })
  const { payload, calls } = conversionPayload([incident(1), incident(2)])
  const run = await convertMaintenanceIncidents(payload, { dryRun: false, rules: [...rules], expect: preview.check })
  assert.equal(run.converted.length, 2)
  assert.deepEqual(calls, ['create', 'delete', 'create', 'delete'])
})

test('Umwandlung: kam seit der Vorschau ein Vorfall dazu, wird nichts angelegt und nichts gelöscht', async () => {
  const preview = await convertMaintenanceIncidents(conversionPayload([incident(1), incident(2)]).payload, { dryRun: true, rules: [...rules] })
  const { payload, calls } = conversionPayload([incident(1), incident(2), incident(3)])
  await assert.rejects(
    () => convertMaintenanceIncidents(payload, { dryRun: false, rules: [...rules], expect: preview.check }),
    (error: unknown) => error instanceof PreviewChangedError && error.expected.count === 2 && error.actual.count === 3,
  )
  assert.deepEqual(calls, [])
})

test('Umwandlung: gleiche Zahl, aber andere Vorfälle, wird abgelehnt', async () => {
  const preview = await convertMaintenanceIncidents(conversionPayload([incident(1), incident(2)]).payload, { dryRun: true, rules: [...rules] })
  const { payload, calls } = conversionPayload([incident(1), incident(9)])
  await assert.rejects(() => convertMaintenanceIncidents(payload, { dryRun: false, rules: [...rules], expect: preview.check }), PreviewChangedError)
  assert.deepEqual(calls, [])
})

test('Umwandlung: eine Änderung an den Vorfällen vor dem Ausführen (die andere Aktion) wird erkannt', async () => {
  // Beispiel aus dem Issue: Die Vorschau sah 2 Vorfälle, dann wandelte jemand einen davon um
  const preview = await convertMaintenanceIncidents(conversionPayload([incident(1), incident(2)]).payload, { dryRun: true, rules: [...rules] })
  const { payload, calls } = conversionPayload([incident(2)])
  await assert.rejects(() => convertMaintenanceIncidents(payload, { dryRun: false, rules: [...rules], expect: preview.check }), PreviewChangedError)
  assert.deepEqual(calls, [])
})
