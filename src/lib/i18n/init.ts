import { join } from 'node:path'
import { readLocaleDir } from './read-locale-dir'
import { buildAdminDictionary, buildSiteDictionary, selectLanguage, type LocaleFile } from './locales'

export type I18nState = {
  // gewählte Sprache (für den ganzen Prozess, bis die Einstellung pro Anfrage gilt)
  language: string
  // Texte der Statusseite, E-Mails, SMS und Feeds
  site: Record<string, string>
  // Texte des Admins (Schlüssel: englischer Text, ggf. mit Zusatz)
  admin: Record<string, string>
  // alle wählbaren Sprachen: eingebaute und aus dem Verzeichnis geladene, sortiert
  available: string[]
  files: Record<string, LocaleFile>
  problems: string[]
}

// Liest einmal beim Start Verzeichnis und Variablen. `accepted` sind die Sprachcodes, die Payload kennt.
// LOCALES_DIR fehlt oder ist leer: `locales` im Arbeitsverzeichnis (im Docker-Image nicht vorhanden,
// dann gelten die eingebauten Fassungen).
export function initI18n(
  env: { LOCALES_DIR?: string; DEFAULT_LANGUAGE?: string },
  builtin: Record<string, LocaleFile>,
  accepted: readonly string[],
  cwd: string = process.cwd(),
): I18nState {
  const dir = env.LOCALES_DIR || join(cwd, 'locales')
  const { files, problems } = readLocaleDir(dir, accepted)
  const available = Array.from(new Set([...Object.keys(builtin), ...Object.keys(files)])).sort()
  const selection = selectLanguage(env.DEFAULT_LANGUAGE || undefined, available)
  if (selection.problem) problems.push(selection.problem)
  return {
    language: selection.language,
    site: buildSiteDictionary(selection.language, files, builtin),
    admin: buildAdminDictionary(selection.language, files, builtin),
    available,
    files,
    problems,
  }
}
