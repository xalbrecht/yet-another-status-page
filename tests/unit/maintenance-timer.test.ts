import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { startMaintenanceTimer } from '@/lib/maintenance/timer'

const STATE = Symbol.for('yasp.maintenanceTimer')
const globals = globalThis as unknown as Record<symbol, { handle: ReturnType<typeof setInterval> } | undefined>

afterEach(() => {
  const state = globals[STATE]
  if (state) clearInterval(state.handle)
  delete globals[STATE]
  delete process.env.DISABLE_MAINTENANCE_TIMER
})

test('der Zeitgeber startet einmal je Prozess', () => {
  assert.equal(startMaintenanceTimer(3_600_000), true)
  assert.equal(startMaintenanceTimer(3_600_000), false)
})

test('mit DISABLE_MAINTENANCE_TIMER=true startet er nicht', () => {
  process.env.DISABLE_MAINTENANCE_TIMER = 'true'
  assert.equal(startMaintenanceTimer(3_600_000), false)
  assert.equal(globals[STATE], undefined)
})
