// Reine Logik für Sprachdateien (ohne Dateizugriff): prüfen, Sprache wählen, Wörterbücher bauen.
// Format der Dateien: docs/superpowers/specs/2026-11-14-sprachdateien-design.md, Abschnitt 4.2.

export type LocaleFile = {
  meta: { name: string; dateLocale?: string }
  site: Record<string, string>
  admin: Record<string, string>
}

const FALLBACK_LANGUAGE = 'de'

// Grund, warum ein Block nicht aus Texten besteht, oder null. Fehlt der Block ganz, gilt er als leer.
function textRecordProblem(name: string, value: unknown): string | null {
  if (value === undefined) return null
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return `${name} ist kein Objekt aus Texten`
  const bad = Object.entries(value).find(([, entry]) => typeof entry !== 'string')
  return bad ? `${name}: der Wert zu "${bad[0]}" ist kein Text` : null
}

// Prüft eine eingelesene Datei. `accepted` sind die Sprachcodes, die das Payload-Paket kennt.
export function parseLocaleFile(
  code: string,
  raw: unknown,
  accepted: readonly string[],
): { file: LocaleFile } | { problem: string } {
  if (!accepted.includes(code)) return { problem: `${code}.json: "${code}" ist kein bekannter Sprachcode` }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { problem: `${code}.json: Inhalt ist kein Objekt` }
  const { meta, site, admin } = raw as Record<string, unknown>
  const name = (meta as { name?: unknown } | undefined)?.name
  if (typeof name !== 'string' || name.trim() === '') return { problem: `${code}.json: meta.name fehlt oder ist leer` }
  const blockProblem = textRecordProblem('site', site) ?? textRecordProblem('admin', admin)
  if (blockProblem) return { problem: `${code}.json: ${blockProblem}` }
  const dateLocale = (meta as { dateLocale?: unknown }).dateLocale
  return {
    file: {
      meta: typeof dateLocale === 'string' ? { name, dateLocale } : { name },
      site: (site ?? {}) as Record<string, string>,
      admin: (admin ?? {}) as Record<string, string>,
    },
  }
}

// Wählt die Sprache. Ist die gewünschte nicht verfügbar, gilt Deutsch und das Problem wird gemeldet.
export function selectLanguage(
  requested: string | undefined,
  available: readonly string[],
): { language: string; problem?: string } {
  if (requested === undefined || requested === '') return { language: FALLBACK_LANGUAGE }
  if (available.includes(requested)) return { language: requested }
  return {
    language: FALLBACK_LANGUAGE,
    problem: `DEFAULT_LANGUAGE="${requested}" ist nicht geladen, es gilt "${FALLBACK_LANGUAGE}"`,
  }
}

// Text nachschlagen, nur eigene Eigenschaften (kein "constructor" von der Prototypkette).
export function lookup(dict: Record<string, string>, key: string): string | undefined {
  if (!Object.hasOwn(dict, key)) return undefined
  const value = dict[key]
  return typeof value === 'string' ? value : undefined
}

// Reihenfolge je Schlüssel: Datei der Sprache, eingebaute Fassung der Sprache, eingebautes Englisch.
export function buildSiteDictionary(
  language: string,
  files: Record<string, LocaleFile>,
  builtin: Record<string, LocaleFile>,
): Record<string, string> {
  return {
    ...(builtin.en?.site ?? {}),
    ...(builtin[language]?.site ?? {}),
    ...(files[language]?.site ?? {}),
  }
}

// Admin: der englische Text ist Schlüssel und Rückfall, deshalb gibt es keine englische Schicht.
export function buildAdminDictionary(
  language: string,
  files: Record<string, LocaleFile>,
  builtin: Record<string, LocaleFile>,
): Record<string, string> {
  return {
    ...(builtin[language]?.admin ?? {}),
    ...(files[language]?.admin ?? {}),
  }
}

// Sprache einer Anfrage: der Wert der Einstellung, wenn die Sprache geladen ist, sonst der Rückfall.
// `includes` statt Objektzugriff, damit Namen wie "constructor" keine Sprache sind.
export function resolveLanguage(
  value: string | null | undefined,
  available: readonly string[],
  fallback: string,
): string {
  return value && available.includes(value) ? value : fallback
}

const DATE_LOCALES: Record<string, string> = {
  de: 'de-DE',
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
  it: 'it-IT',
  pl: 'pl-PL',
  tr: 'tr-TR',
}

// Datumssprache (BCP 47): Angabe der Datei, sonst Ableitung aus dem Sprachcode, sonst der Code selbst.
export function deriveDateLocale(code: string, meta?: { dateLocale?: string }): string {
  return meta?.dateLocale || (Object.hasOwn(DATE_LOCALES, code) ? DATE_LOCALES[code] : code)
}
