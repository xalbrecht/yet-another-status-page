/**
 * Auffangnetz zum Zeitgeber: Liest jemand eine Wartung, deren Zeitplan abgelaufen ist, stößt das die Umstellung an
 * (höchstens alle 30 Sekunden je Prozess). So bleibt die Umstellung auch dann nicht aus, wenn der Zeitgeber nicht läuft.
 */
const MIN_GAP_MS = 30_000
let lastTrigger = 0

export function triggerDueProcessing(now: number = Date.now()): void {
  if (now - lastTrigger < MIN_GAP_MS) return
  lastTrigger = now
  setImmediate(async () => {
    try {
      const { getPayload } = await import('payload')
      const config = (await import('@payload-config')).default
      const payload = await getPayload({ config })
      const { processDueMaintenances } = await import('./process-due')
      await processDueMaintenances(payload)
    } catch (error) {
      console.error('[Maintenances] Umstellung nach dem Lesen fehlgeschlagen:', error)
    }
  })
}
