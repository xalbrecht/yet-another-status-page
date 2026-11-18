/**
 * Antwort einer Route lesen, die JSON liefern soll. Ein Proxy oder Server kann stattdessen HTML liefern (zum Beispiel HTTP 502):
 * Dann gibt es kein JSON, und die Oberfläche soll den HTTP-Status nennen statt „Unexpected token …“. Ohne Abhängigkeiten.
 */
export function parseJsonBody(text: string): unknown | null {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** Text für einen fehlgeschlagenen Aufruf: die Meldung der Route, sonst der Hinweis mit dem HTTP-Status. */
export function failureMessage(status: number, body: unknown, withStatus: (status: number) => string): string {
  const error = typeof body === 'object' && body !== null ? (body as { error?: unknown }).error : undefined
  return typeof error === 'string' && error !== '' ? error : withStatus(status)
}
