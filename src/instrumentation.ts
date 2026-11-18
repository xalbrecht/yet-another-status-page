/**
 * Wird einmal beim Start des Servers aufgerufen (Next.js). Startet den Zeitgeber der Wartungen.
 * Nicht beim Bauen des Images und nicht in anderen Laufzeiten als Node.js.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  const { startMaintenanceTimer } = await import('./lib/maintenance/timer')
  startMaintenanceTimer()
}
