import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isStatusLogMaintenanceDisabled } from '@/lib/status-log-maintenance'

test('ohne Variable bleibt „Statusprotokoll pflegen“ aktiv', () => {
  assert.equal(isStatusLogMaintenanceDisabled({}), false)
})

test('nur der Wert „true“ schaltet die Funktion ab', () => {
  assert.equal(isStatusLogMaintenanceDisabled({ DISABLE_STATUS_LOG_MAINTENANCE: 'true' }), true)
  for (const other of ['false', 'TRUE', '1', 'yes', '']) {
    assert.equal(isStatusLogMaintenanceDisabled({ DISABLE_STATUS_LOG_MAINTENANCE: other }), false, other)
  }
})

// Die Sperre der Routen greift vor Anmeldung und Datenbank, deshalb genügt ein Aufruf ohne Server.
for (const route of ['rebuild', 'convert-maintenance']) {
  test(`POST /api/status-log/${route} antwortet bei abgeschalteter Funktion mit 403 und Code`, async () => {
    const before = process.env.DISABLE_STATUS_LOG_MAINTENANCE
    process.env.DISABLE_STATUS_LOG_MAINTENANCE = 'true'
    try {
      const { POST } = await import(`@/app/api/status-log/${route}/route`)
      const response = await POST(new Request('http://localhost/api/status-log', { method: 'POST', body: '{}' }) as never)
      assert.equal(response.status, 403)
      const body = await response.json()
      assert.equal(body.code, 'status-log-maintenance-disabled')
      assert.ok(body.error)
    } finally {
      if (before === undefined) delete process.env.DISABLE_STATUS_LOG_MAINTENANCE
      else process.env.DISABLE_STATUS_LOG_MAINTENANCE = before
    }
  })
}
