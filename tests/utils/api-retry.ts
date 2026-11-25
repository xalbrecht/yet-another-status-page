import type { APIRequestContext, APIResponse } from '@playwright/test'

const RESET = /ECONNRESET|socket hang up/

/**
 * GET mit Wiederholung bei einem Verbindungsabbruch (Issue #278).
 *
 * Der Dev-Server schließt ruhende Verbindungen nach 6 s. Wiederverwendet der Test die Verbindung in genau diesem
 * Moment (Leerlauf 6,0 s ± wenige ms), trifft die Anfrage die schon geschlossene Verbindung und scheitert mit
 * `ECONNRESET` oder `socket hang up`, ohne dass der Server sie sieht. Das Lesen verändert nichts, ein zweiter Versuch
 * öffnet eine neue Verbindung. Andere Fehler (Zeitüberschreitung, Statuscodes) werden nicht wiederholt.
 */
export async function getWithReset(request: APIRequestContext, url: string, attempts = 3): Promise<APIResponse> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await request.get(url)
    } catch (error) {
      if (attempt >= attempts || !RESET.test(String((error as Error).message))) throw error
    }
  }
}
