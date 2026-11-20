import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Incidents } from '@/collections/Incidents'
import { Maintenances } from '@/collections/Maintenances'

// Regression zu #231: Der Entwurf entsteht in derselben Transaktion wie die Störung bzw. Wartung.
// Ein Entwurf auf einer zweiten Verbindung (setImmediate) sieht den noch nicht abgeschlossenen
// Datensatz nicht und scheitert an der Fremdschlüsselbeziehung.

type Hook = (args: Record<string, unknown>) => Promise<unknown> | unknown
type Created = { collection: string; req: unknown; data: Record<string, unknown> }

function fakeRequest(created: Created[]) {
  const req: Record<string, unknown> = { context: {}, transactionID: 'tx-1' }
  req.payload = {
    findGlobal: async () => ({ siteName: 'Statusseite' }),
    find: async () => ({ docs: [], totalDocs: 0 }),
    update: async () => ({}),
    create: async (args: { collection: string; req?: unknown; data: Record<string, unknown> }) => {
      // Ein Aufruf ohne req läuft auf einer eigenen Verbindung und sieht die offene Transaktion nicht.
      // Er scheitert wie Postgres an der Fremdschlüsselbeziehung, wenn er nicht auf den Commit wartet.
      if (args.req !== req) throw new Error('violates foreign key constraint (Entwurf außerhalb der Transaktion)')
      created.push({ collection: args.collection, req: args.req, data: args.data })
      return { id: 1 }
    },
  }
  return req
}

/** Führt alle afterChange-Hooks nacheinander aus und wartet auf jeden. */
async function runAfterChange(collection: { hooks?: { afterChange?: unknown[] } }, args: Record<string, unknown>) {
  for (const hook of (collection.hooks?.afterChange ?? []) as Hook[]) {
    await hook(args)
  }
}

const incident = {
  id: 5,
  title: 'Störung',
  shortId: 'abc123',
  affectedServices: [],
  updates: [{ status: 'investigating', message: 'Wir prüfen.', createNotificationDraft: true }],
}

test('Störung anlegen: Entwurf steht beim Rückkehren des Hooks in derselben Transaktion', async () => {
  const created: Created[] = []
  const req = fakeRequest(created)
  await runAfterChange(Incidents, { doc: incident, previousDoc: undefined, operation: 'create', req })
  assert.equal(created.length, 1, 'Der Hook kehrt zurück, bevor der Entwurf angelegt ist')
  assert.equal(created[0].collection, 'notifications')
  assert.equal(created[0].req, req)
})

test('Neue Aktualisierung einer Störung: Entwurf in derselben Transaktion', async () => {
  const created: Created[] = []
  const req = fakeRequest(created)
  const doc = { ...incident, updates: [...incident.updates, { status: 'identified', message: 'Ursache gefunden.', createNotificationDraft: true }] }
  await runAfterChange(Incidents, { doc, previousDoc: incident, operation: 'update', req })
  assert.equal(created.length, 1)
  assert.equal(created[0].req, req)
})

test('Wartung anlegen: Entwurf in derselben Transaktion', async () => {
  const created: Created[] = []
  const req = fakeRequest(created)
  const doc = { id: 9, title: 'Wartung', shortId: 'm12345', status: 'upcoming', updates: [] }
  await runAfterChange(Maintenances, { doc, previousDoc: undefined, operation: 'create', req })
  assert.equal(created.length, 1, 'Der Hook kehrt zurück, bevor der Entwurf angelegt ist')
  assert.equal(created[0].req, req)
})

test('Neue Aktualisierung einer Wartung: Entwurf in derselben Transaktion', async () => {
  const created: Created[] = []
  const req = fakeRequest(created)
  const before = { id: 9, title: 'Wartung', shortId: 'm12345', status: 'upcoming', updates: [] }
  const doc = { ...before, updates: [{ status: 'upcoming', message: 'Verschoben.', createNotificationDraft: true }] }
  await runAfterChange(Maintenances, { doc, previousDoc: before, operation: 'update', req })
  assert.equal(created.length, 1)
  assert.equal(created[0].req, req)
})

test('Scheitert der Entwurf, meldet der Hook den Fehler, statt ihn nur zu protokollieren', async () => {
  const req = fakeRequest([])
  ;(req.payload as { create: unknown }).create = async () => {
    throw new Error('Entwurf nicht angelegt')
  }
  await assert.rejects(runAfterChange(Incidents, { doc: incident, previousDoc: undefined, operation: 'create', req }), /Entwurf nicht angelegt/)
})
