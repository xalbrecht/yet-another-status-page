// Größengrenze je Mail im Versand des Verfügbarkeitsberichts. Eigene Datei ohne weitere Importe, weil auch die
// E-Mail-Einstellungen (Feld und Grenzen) sie lesen.

/** Vorgabe, wenn die E-Mail-Einstellungen keinen Wert nennen. Base64 macht aus 6 MB rund 8,2 MB, das passt unter eine Annahmegrenze von 10 MB. */
export const MAIL_PART_LIMIT_DEFAULT_MB = 6
export const MAIL_PART_LIMIT_MIN_MB = 1
export const MAIL_PART_LIMIT_MAX_MB = 50
export const MAIL_PART_LIMIT_BYTES = MAIL_PART_LIMIT_DEFAULT_MB * 1_000_000

/** Grenze je Mail in Byte aus der Einstellung in Megabyte. Leer, 0 oder ungültig ergibt die Vorgabe, sonst gilt der Bereich 1 bis 50 MB. */
export function mailPartLimitBytes(megabytes: number | null | undefined): number {
  if (typeof megabytes !== 'number' || !Number.isFinite(megabytes) || megabytes <= 0) return MAIL_PART_LIMIT_BYTES
  return Math.round(Math.min(MAIL_PART_LIMIT_MAX_MB, Math.max(MAIL_PART_LIMIT_MIN_MB, megabytes)) * 1_000_000)
}
