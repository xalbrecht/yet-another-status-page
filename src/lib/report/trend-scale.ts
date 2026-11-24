/**
 * Senkrechte Achse des Verlaufsdiagramms (Ansicht und Export): oberes Ende 100 %, unteres Ende knapp unter dem
 * niedrigsten Wert oder dem Zielwert. Die Schrittweite wächst mit dem Wertebereich, sodass höchstens etwa sieben
 * Gitterlinien entstehen, auch bei sehr niedrigen Werten (frische Umgebung ohne Statusprotokoll).
 */
export function trendScale(known: number[], target: number): { min: number; max: number; step: number; grid: number[] } {
  const max = 100
  const low = Math.min(...known, target) - 0.5
  const step = [0.25, 0.5, 1, 2, 5, 10, 20, 25, 50].find((candidate) => (max - low) / candidate <= 7) ?? 50
  const min = Math.floor(low / step) * step
  const grid: number[] = []
  for (let value = max; value >= min - 1e-9; value -= step) grid.push(value)
  return { min, max, step, grid }
}
