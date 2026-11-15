import enJson from '../../../locales/en.json' with { type: 'json' }
import { i18nState } from './state'

// Quelle der Wahrheit für alle Schlüssel ist locales/en.json (Block site).
// Platzhalter: {name} (mit tf()), {{name}} bleibt unverändert (Template-Syntax der Settings).
export type TranslationKey = keyof typeof enJson.site

// Texte kommen pro Anfrage aus `@/lib/i18n/server` (getTranslators) oder `@/lib/i18n/translators`
// (translatorsFor, translatorsForSettings). Dieses Modul enthält nur den Typ und die Listen.

// Wählbare Sprachen und Probleme beim Einlesen des Sprachverzeichnisses.
export const availableLanguages: string[] = i18nState.available
export const localeProblems: string[] = i18nState.problems
