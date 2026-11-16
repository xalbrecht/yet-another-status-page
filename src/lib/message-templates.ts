/**
 * Vorlagen für Meldungen (Störungen und Wartungen): Platzhalter prüfen und ersetzen.
 * Reine Funktionen ohne Datenbankzugriff. Eine Vorlage hat einen Titel, einen Text für Statusseite und E-Mail, optional
 * einen SMS-Text und einen ntfy-Text. Alle vier Texte dürfen Platzhalter der Schreibweise `{{name}}` enthalten.
 */
import { incidentStatusOptions } from '@/collections/Incidents'
import { formatServiceList, NTFY_TEXT_MAX_LENGTH, placeholdersIn, renderTemplate, SMS_TEXT_MAX_LENGTH } from '@/lib/template-text'
import { maintenanceStatusOptions } from '@/collections/Maintenances'

export type TemplateKind = 'incident' | 'maintenance'

// Die Funktionen für Platzhalter und Aufzählung stehen in `template-text.ts`; hier bleiben sie unter dem bisherigen Namen erreichbar
export { formatServiceList, NTFY_TEXT_MAX_LENGTH, placeholdersIn, renderTemplate, SMS_TEXT_MAX_LENGTH }

/** Platzhalter je Art der Vorlage. `link` kennt erst der Hook, der die Benachrichtigung anlegt (die Kennung der Meldung entsteht beim Speichern). */
export const PLACEHOLDERS = {
  incident: ['services', 'group', 'impact', 'link'],
  maintenance: ['services', 'group', 'start', 'end', 'link'],
} as const satisfies Record<TemplateKind, readonly string[]>

export type PlaceholderName = (typeof PLACEHOLDERS)[TemplateKind][number]

/** Aktualisierungsstatus, die zu einer Art gehören. Dieselben Listen wie bei den Störungen und Wartungen: Ein neuer Status gilt automatisch auch für Vorlagen. */
export const STATUS_VALUES = {
  incident: incidentStatusOptions.map((option) => option.value) as readonly string[],
  maintenance: maintenanceStatusOptions.map((option) => option.value) as readonly string[],
}

export function isStatusOfKind(kind: TemplateKind, status: string): boolean {
  return STATUS_VALUES[kind].includes(status)
}

/** Platzhalter, die für die Art nicht erlaubt sind. Leer: der Text ist in Ordnung. */
export function unknownPlaceholders(text: string, kind: TemplateKind): string[] {
  const allowed: readonly string[] = PLACEHOLDERS[kind]
  return placeholdersIn(text).filter((name) => !allowed.includes(name))
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
