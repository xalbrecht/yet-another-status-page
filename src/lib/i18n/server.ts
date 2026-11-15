import { getSettings } from '@/lib/payload'
import { translatorsFor, translatorsForSettings, type Translators } from './translators'
import { i18nState } from './state'

export { translatorsFor, translatorsForSettings, languageOptions, type Translators } from './translators'

// Sprache der laufenden Anfrage aus den Einstellungen (getSettings() liest einmal je Anfrage).
// Ist die Datenbank nicht erreichbar, gilt DEFAULT_LANGUAGE, damit Fehlerseiten erscheinen.
export async function getTranslators(): Promise<Translators> {
  try {
    return translatorsForSettings(await getSettings())
  } catch {
    return translatorsFor(i18nState.language)
  }
}
