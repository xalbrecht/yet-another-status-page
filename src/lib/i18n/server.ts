import { translatorsFor, type Translators } from './translators'

export { translatorsFor, languageOptions, type Translators } from './translators'

// Sprache der Anfrage: DEFAULT_LANGUAGE (Umgebungsvariable, Wechsel mit Neustart).
export function getTranslators(): Translators {
  return translatorsFor()
}
