/**
 * Lage des Aufklappbereichs im Raster der Gruppenkacheln. Die Kachel „Alle“ steht außerhalb des Rasters
 * und zählt hier nicht mit: Index und Spaltenzahl beziehen sich nur auf die Gruppen.
 */

/** Steht der Aufklappbereich der gewählten Gruppe hinter der Kachel `index`? Er folgt der letzten Kachel der Zeile. */
export function panelFollowsTile(index: number, total: number, columns: number, selectedIndex: number): boolean {
  if (selectedIndex < 0) return false
  const endsRow = index === total - 1 || (index + 1) % columns === 0
  return endsRow && Math.floor(selectedIndex / columns) === Math.floor(index / columns)
}

/** Waagerechte Lage des Pfeils in Prozent der Rasterbreite: Mitte der Spalte der gewählten Gruppe. */
export function caretPosition(selectedIndex: number, columns: number): number {
  return (((selectedIndex % columns) + 0.5) / columns) * 100
}
