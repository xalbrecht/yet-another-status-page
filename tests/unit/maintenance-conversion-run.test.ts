import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import { convertMaintenanceIncidents } from '@/lib/maintenance-conversion'

test('scheitert die Nachrechnung nach der Umwandlung, steht der Fehler im Ergebnis statt in einer Ausnahme', async () => {
  const payload = {
    find: async () => ({ docs: [] }),
    db: { drizzle: { execute: async () => { throw new Error('Datenbank nicht erreichbar') } } },
  } as unknown as Payload
  const result = await convertMaintenanceIncidents(payload, { dryRun: false })
  assert.match(result.rebuildError ?? '', /Datenbank nicht erreichbar/)
  assert.equal(result.rebuild, undefined)
})
