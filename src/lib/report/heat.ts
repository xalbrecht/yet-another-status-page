/**
 * Hilfen der Wärmekarte (Konzept 4): Farbstufe eines Werts und die Teilung in Blöcke zu höchstens 12 Zeilen.
 * Gemeinsam genutzt von der Wärmekarte, der Gruppenliste und später vom Export.
 */
export type HeatLevel = 0 | 1 | 2 | 3 | 4

/** Stufen: 0 = 100 % oder unbekannt, 1 ab 99,9 %, 2 ab 99,5 %, 3 ab Zielwert, 4 unter Zielwert. */
export function heatClass(value: number | null, target: number): HeatLevel {
  if (value === null) return 0
  if (value >= 100) return 0
  if (value >= 99.9) return 1
  if (value >= 99.5) return 2
  if (value >= target) return 3
  return 4
}

export const HEAT_CHUNK_SIZE = 12

/** Teilt Zeilen in Blöcke der Länge `size` (der letzte Block kann kürzer sein). Keine Zeilen ergeben keinen Block. */
export function chunkRows<T>(rows: T[], size: number = HEAT_CHUNK_SIZE): T[][] {
  const chunks: T[][] = []
  for (let start = 0; start < rows.length; start += size) chunks.push(rows.slice(start, start + size))
  return chunks
}
