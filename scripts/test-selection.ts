/**
 * Reine Prüflogik zur Testauswahl (Issue #211). Kein Zugriff auf Dateisystem oder Playwright,
 * damit ein Unit-Test sie prüfen kann. Der Aufruf steht in `check-test-selection.mts`.
 */
import { matchesGlob } from 'node:path'

export const ALL = '*'

export type SelectionTable = {
  geprueftePfade: string[]
  tags: { ebene: string[]; bereich: string[] }
  pfade: Record<string, string[]>
}

export type ListedTest = { file: string; title: string; tags: string[] }

/** Erster passender Eintrag der Tabelle für eine Datei, oder `null`. */
export function lookup(file: string, pfade: SelectionTable['pfade']): { pattern: string; tags: string[] } | null {
  for (const [pattern, tags] of Object.entries(pfade)) {
    if (matchesGlob(file, pattern)) return { pattern, tags }
  }
  return null
}

/** Dateien, die die Tabelle prüfen soll (Muster aus `geprueftePfade`). */
export function checkedFiles(files: string[], table: SelectionTable): string[] {
  return files.filter((f) => table.geprueftePfade.some((p) => matchesGlob(f, p)))
}

/** Fehler der Tabelle: Datei ohne Eintrag, Eintrag ohne Datei, unbekannter Tag. */
export function checkTable(files: string[], table: SelectionTable): string[] {
  const errors: string[] = []
  const known = new Set([...table.tags.ebene, ...table.tags.bereich, ALL])
  const checked = checkedFiles(files, table)
  for (const f of checked) {
    if (!lookup(f, table.pfade)) errors.push(`Pfad ohne Eintrag in der Tabelle: ${f}`)
  }
  for (const [pattern, tags] of Object.entries(table.pfade)) {
    if (!checked.some((f) => matchesGlob(f, pattern))) errors.push(`Eintrag ohne passende Datei (veraltet?): ${pattern}`)
    for (const t of tags) if (!known.has(t)) errors.push(`Unbekannter Tag ${t} im Eintrag ${pattern}`)
    if (tags.length === 0) errors.push(`Eintrag ohne Tags: ${pattern}`)
    if (tags.includes(ALL) && tags.length > 1) errors.push(`„${ALL}“ darf nicht mit weiteren Tags stehen: ${pattern}`)
  }
  return errors
}

/** Fehler an den Tests: genau eine Ebene, mindestens ein Bereich, nur bekannte Tags. */
export function checkTests(tests: ListedTest[], table: SelectionTable): string[] {
  const errors: string[] = []
  const ebene = new Set(table.tags.ebene)
  const bereich = new Set(table.tags.bereich)
  for (const t of tests) {
    const tags = [...new Set(t.tags.map((x) => (x.startsWith('@') ? x : `@${x}`)))]
    const where = `${t.file}: ${t.title}`
    const e = tags.filter((x) => ebene.has(x))
    const b = tags.filter((x) => bereich.has(x))
    if (e.length !== 1) errors.push(`Test braucht genau eine Ebene (${[...ebene].join(', ')}), hat ${e.length}: ${where}`)
    if (b.length === 0) errors.push(`Test braucht mindestens einen Bereich: ${where}`)
    for (const x of tags) if (!ebene.has(x) && !bereich.has(x)) errors.push(`Unbekannter Tag ${x}: ${where}`)
  }
  return errors
}

/** Tags für eine Menge geänderter Dateien. `null` heißt: volle Suite. */
export function tagsForFiles(files: string[], table: SelectionTable): string[] | null {
  const tags = new Set<string>()
  for (const f of checkedFiles(files, table)) {
    const hit = lookup(f, table.pfade)
    if (!hit || hit.tags.includes(ALL)) return null
    hit.tags.forEach((t) => tags.add(t))
  }
  return [...tags].sort()
}
