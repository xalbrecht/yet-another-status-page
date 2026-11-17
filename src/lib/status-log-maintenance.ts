/**
 * Schalter für „Statusprotokoll pflegen“. `DISABLE_STATUS_LOG_MAINTENANCE=true` sperrt die Seite und die beiden
 * Routen, die das Protokoll ändern (`/api/status-log/rebuild`, `/api/status-log/convert-maintenance`). Ohne die
 * Variable bleibt die Funktion aktiv. Die Berichtsseite liest das Protokoll weiter wie bisher.
 *
 * Bewusst ohne Abhängigkeiten, damit Server und Admin-Komponenten die Funktion gleichermaßen laden können.
 */
export const STATUS_LOG_MAINTENANCE_DISABLED_CODE = 'status-log-maintenance-disabled'

export function isStatusLogMaintenanceDisabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.DISABLE_STATUS_LOG_MAINTENANCE === 'true'
}
