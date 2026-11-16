/**
 * Texte mit Platzhaltern der Schreibweise `{{name}}`: Platzhalter finden, ersetzen, Dienste aufzählen. Reine Funktionen ohne
 * Abhängigkeit von den Collections (die Collections der Störungen und der Vorlagen importieren dieses Modul).
 */

/** Längengrenzen: Ein SMS-Text über 320 Zeichen kürzt `formatSmsMessage` ohnehin (zwei Segmente). Der ntfy-Text soll kurz sein. */
export const SMS_TEXT_MAX_LENGTH = 320
export const NTFY_TEXT_MAX_LENGTH = 500

const PLACEHOLDER_PATTERN = /\{\{\s*(\w+)\s*\}\}/g

/** Alle Platzhalter eines Textes, ohne Wiederholungen, in der Reihenfolge des ersten Auftretens. */
export function placeholdersIn(text: string): string[] {
  const names: string[] = []
  for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
    if (!names.includes(match[1])) names.push(match[1])
  }
  return names
}

/**
 * Ersetzt die übergebenen Platzhalter. Ein Platzhalter ohne Wert bleibt stehen, damit ein späterer Schritt ihn ersetzen
 * kann (`{{link}}` erst beim Anlegen der Benachrichtigung).
 */
export function renderTemplate(text: string, values: Partial<Record<string, string>>): string {
  return text.replace(PLACEHOLDER_PATTERN, (whole, name: string) => (Object.hasOwn(values, name) ? (values[name] ?? '') : whole))
}

/** Aufzählung nach den Regeln der Sprache: „A, B und C“ (Deutsch) bzw. „A, B, and C“ (Englisch). Ohne Namen leer. */
export function formatServiceList(names: string[], locale: string): string {
  if (names.length === 0) return ''
  try {
    return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(names)
  } catch {
    return names.join(', ')
  }
}
