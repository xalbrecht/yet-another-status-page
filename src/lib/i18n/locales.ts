// Reine Logik für Sprachdateien (ohne Dateizugriff): prüfen, Sprache wählen, Wörterbücher bauen.
// Format der Dateien: docs/superpowers/specs/2026-11-14-sprachdateien-design.md, Abschnitt 4.2.

export type LocaleFile = {
  meta: { name: string; dateLocale?: string }
  site: Record<string, string>
  admin: Record<string, string>
}

const FALLBACK_LANGUAGE = 'de'

function isTextRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return Object.values(value).every((entry) => typeof entry === 'string')
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
  if (!isTextRecord(site)) return { problem: `${code}.json: site ist kein Objekt aus Texten` }
  if (!isTextRecord(admin)) return { problem: `${code}.json: admin ist kein Objekt aus Texten` }
  const dateLocale = (meta as { dateLocale?: unknown }).dateLocale
  return {
    file: { meta: typeof dateLocale === 'string' ? { name, dateLocale } : { name }, site, admin },
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
