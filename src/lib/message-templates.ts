/**
 * Vorlagen für Meldungen (Störungen und Wartungen): Platzhalter prüfen und ersetzen.
 * Reine Funktionen ohne Datenbankzugriff. Eine Vorlage hat einen Titel, einen Text für Statusseite und E-Mail, optional
 * einen SMS-Text und einen ntfy-Text. Alle vier Texte dürfen Platzhalter der Schreibweise `{{name}}` enthalten.
 */
import { incidentStatusOptions } from '@/collections/Incidents'
import { maintenanceStatusOptions } from '@/collections/Maintenances'

export type TemplateKind = 'incident' | 'maintenance'

/** Längengrenzen: Ein SMS-Text über 320 Zeichen kürzt `formatSmsMessage` ohnehin (zwei Segmente). Der ntfy-Text soll kurz sein. */
export const SMS_TEXT_MAX_LENGTH = 320
export const NTFY_TEXT_MAX_LENGTH = 500

/** Platzhalter je Art der Vorlage. `link` kennt erst der Hook, der die Benachrichtigung anlegt (die Kennung der Meldung entsteht beim Speichern). */
export const PLACEHOLDERS = {
  incident: ['services', 'group', 'impact', 'link'],
  maintenance: ['services', 'group', 'start', 'end', 'link'],
} as const satisfies Record<TemplateKind, readonly string[]>

export type PlaceholderName = (typeof PLACEHOLDERS)[TemplateKind][number]

const PLACEHOLDER_PATTERN = /\{\{\s*(\w+)\s*\}\}/g

/** Aktualisierungsstatus, die zu einer Art gehören. Dieselben Listen wie bei den Störungen und Wartungen: Ein neuer Status gilt automatisch auch für Vorlagen. */
export const STATUS_VALUES = {
  incident: incidentStatusOptions.map((option) => option.value) as readonly string[],
  maintenance: maintenanceStatusOptions.map((option) => option.value) as readonly string[],
}

export function isStatusOfKind(kind: TemplateKind, status: string): boolean {
  return STATUS_VALUES[kind].includes(status)
}

/** Alle Platzhalter eines Textes, ohne Wiederholungen, in der Reihenfolge des ersten Auftretens. */
export function placeholdersIn(text: string): string[] {
  const names: string[] = []
  for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
    if (!names.includes(match[1])) names.push(match[1])
  }
  return names
}

/** Platzhalter, die für die Art nicht erlaubt sind. Leer: der Text ist in Ordnung. */
export function unknownPlaceholders(text: string, kind: TemplateKind): string[] {
  const allowed: readonly string[] = PLACEHOLDERS[kind]
  return placeholdersIn(text).filter((name) => !allowed.includes(name))
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

export type TemplateTextCheck =
  | { ok: true }
  | { ok: false; problem: 'required' }
  | { ok: false; problem: 'too-long'; max: number }
  | { ok: false; problem: 'unknown-placeholder'; names: string[]; allowed: readonly string[] }

/**
 * Prüft einen Text der Vorlage: nicht leer (wenn Pflicht), nicht länger als erlaubt und nur Platzhalter, die für die Art
 * erlaubt sind. Die eigene Prüfung ersetzt die eingebaute von Payload, deshalb gehört die Längengrenze hierher.
 */
export function checkTemplateText(
  value: string | null | undefined,
  options: { required: boolean; kind: TemplateKind; maxLength?: number },
): TemplateTextCheck {
  const text = (value ?? '').trim()
  if (text === '') return options.required ? { ok: false, problem: 'required' } : { ok: true }
  if (options.maxLength !== undefined && text.length > options.maxLength) return { ok: false, problem: 'too-long', max: options.maxLength }
  const names = unknownPlaceholders(text, options.kind)
  return names.length === 0 ? { ok: true } : { ok: false, problem: 'unknown-placeholder', names, allowed: PLACEHOLDERS[options.kind] }
}
