import { processDueMaintenances } from './process-due'

/**
 * Zeitgeber der Wartungen: Der Server prüft jede Minute, ob eine Wartung nach ihrem Zeitplan zu beginnen oder zu enden hat.
 * Gestartet beim Hochfahren (`src/instrumentation.ts`). Mit `DISABLE_MAINTENANCE_TIMER=true` startet er nicht (zum Beispiel,
 * wenn ein Prozess allein zuständig sein soll). Mehrere Prozesse stören sich nicht: die Umstellung läuft unter einer Sperre.
 */
export const MAINTENANCE_TIMER_INTERVAL_MS = 60_000
/** Erste Prüfung kurz nach dem Start, damit der Server Anfragen annimmt und Payload fertig ist. */
const FIRST_TICK_DELAY_MS = 15_000

const STATE = Symbol.for('yasp.maintenanceTimer')
type TimerState = { handle: ReturnType<typeof setInterval>; running: boolean }

async function tick(state: TimerState) {
  if (state.running) return // die vorige Umstellung (zum Beispiel ein langer Versand) läuft noch
  state.running = true
  try {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    const payload = await getPayload({ config })
    const result = await processDueMaintenances(payload)
    if (result.transitioned.length > 0) {
      console.log(`[Maintenances] ${result.transitioned.length} Wartung(en) nach Zeitplan umgestellt`)
    }
  } catch (error) {
    console.error('[Maintenances] Zeitgeber:', error)
  } finally {
    state.running = false
  }
}

/** Startet den Zeitgeber einmal je Prozess (auch bei Neuladen im Entwicklungsmodus). Gibt zurück, ob er neu gestartet wurde. */
export function startMaintenanceTimer(intervalMs: number = MAINTENANCE_TIMER_INTERVAL_MS): boolean {
  if (process.env.DISABLE_MAINTENANCE_TIMER === 'true') return false
  const globals = globalThis as unknown as Record<symbol, TimerState | undefined>
  if (globals[STATE]) return false
  const state: TimerState = { handle: setInterval(() => void tick(state), intervalMs), running: false }
  // Der Zeitgeber hält den Prozess nicht am Leben
  state.handle.unref?.()
  globals[STATE] = state
  setTimeout(() => void tick(state), FIRST_TICK_DELAY_MS).unref?.()
  return true
}
