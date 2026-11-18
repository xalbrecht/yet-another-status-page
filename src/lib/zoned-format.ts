/**
 * Zeitpunkt für die Oberfläche in der Zeitzone der Installation („25.11.2026, 22:00 MEZ“). Ohne Abhängigkeiten, läuft auch im
 * Browser. Ungültiger Zeitpunkt: leer. Unbekannte Zeitzone oder Sprache: Rückfall auf UTC und Englisch.
 */
export function formatZonedDateTime(value: string | number | Date, locale: string, timeZone: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }
  try {
    return date.toLocaleString(locale, { ...options, timeZone })
  } catch {
    return date.toLocaleString('en', { ...options, timeZone: 'UTC' })
  }
}
