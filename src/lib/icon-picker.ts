/**
 * Auswahl eines Symbols im Raster: Pfeiltasten bewegen die Auswahl wie bei einer Gruppe von Optionsfeldern. Reine Funktion, ohne
 * Abhängigkeiten, läuft auch im Browser.
 */
export function nextIconIndex(key: string, index: number, count: number): number | null {
  if (count <= 0) return null
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (index + 1) % count
    case 'ArrowLeft':
    case 'ArrowUp':
      return (index - 1 + count) % count
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}

/** Index des gewählten Eintrags. Ist der Wert unbekannt (zum Beispiel ein entferntes Symbol), erhält der erste Eintrag den Fokus. */
export function selectedIconIndex(values: readonly string[], value: string | null | undefined): number {
  const index = value ? values.indexOf(value) : -1
  return index >= 0 ? index : 0
}
