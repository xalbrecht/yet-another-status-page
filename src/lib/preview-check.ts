import { createHash } from 'node:crypto'

/**
 * Prüfung „Stimmt die Vorschau noch?“ für Admin-Aktionen mit Vorschau und Ausführen.
 * Die Vorschau liefert `count` (die Zahl, die der Admin sieht) und `fingerprint` (Hash der Menge, auf die sie sich bezieht).
 * Beim Ausführen schickt die Oberfläche beide Werte zurück. Der Server rechnet die Vorschau neu und führt nichts aus,
 * wenn der Hash abweicht. Die Prüfung liegt im Server, sie gilt auch nach Neuladen der Seite und bei zwei Admins.
 */
export type PreviewCheck = { count: number; fingerprint: string }

/** Kurzer Hash eines JSON-Werts. Die Reihenfolge von Listen muss der Aufrufer festlegen (sortieren), sonst ist der Hash instabil. */
export function fingerprintOf(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16)
}

export class PreviewChangedError extends Error {
  constructor(
    readonly expected: PreviewCheck,
    readonly actual: PreviewCheck,
  ) {
    super('The preview is out of date')
    this.name = 'PreviewChangedError'
  }
}

/** Wirft `PreviewChangedError`, wenn eine Erwartung vorliegt und der aktuelle Hash abweicht. Ohne Erwartung geschieht nichts. */
export function assertPreviewMatches(expected: PreviewCheck | undefined, actual: PreviewCheck): void {
  if (expected && expected.fingerprint !== actual.fingerprint) throw new PreviewChangedError(expected, actual)
}

/** Liest die Erwartung aus dem Anfragekörper. Kein gültiger Wert ergibt `undefined`. */
export function parseExpected(value: unknown): PreviewCheck | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const { count, fingerprint } = value as { count?: unknown; fingerprint?: unknown }
  if (typeof count !== 'number' || !Number.isFinite(count) || typeof fingerprint !== 'string' || fingerprint === '') return undefined
  return { count, fingerprint }
}

/** Meldung für den Admin. Mit gleicher Zahl, aber anderem Inhalt, nennt sie keine Zahlen. */
export function previewChangedMessage(error: PreviewChangedError, ta: (text: string) => string): string {
  if (error.expected.count === error.actual.count) {
    return ta('Since the preview the data changed. Please run the preview again.')
  }
  return ta('Since the preview the numbers changed (preview: {before}, now: {after}). Please run the preview again.')
    .replace('{before}', String(error.expected.count))
    .replace('{after}', String(error.actual.count))
}
