import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import { DEFAULT_DATETIME_CONFIG } from '@/lib/datetime'
import { translatorsFor } from '@/lib/i18n/translators'
import { loadLagebild } from '@/lib/lagebild'
import { activeServiceWhere } from '@/lib/service-lifecycle'

const NOW = new Date(Date.UTC(2026, 10, 17, 12, 0, 0))

/** Das Lagebild liest nur Dienste, die zum Zeitpunkt der Berechnung aktiv sind. */
test('loadLagebild fragt die Dienste mit dem Filter für aktive Dienste ab', async () => {
  const calls: Array<{ collection: string; where?: unknown }> = []
  const payload = {
    find: async (args: { collection: string; where?: unknown }) => {
      calls.push({ collection: args.collection, where: args.where })
      return { docs: [], totalDocs: 0 }
    },
  } as unknown as Payload
  const { t, tf } = translatorsFor('')
  await loadLagebild(payload, DEFAULT_DATETIME_CONFIG, { t, tf }, undefined, undefined, NOW)
  const services = calls.find((call) => call.collection === 'services')
  assert.ok(services, 'Dienste wurden nicht gelesen')
  assert.deepEqual(services.where, activeServiceWhere(NOW.getTime()))
})
