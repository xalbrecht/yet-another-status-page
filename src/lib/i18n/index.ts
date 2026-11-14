import enJson from '../../../locales/en.json' with { type: 'json' }
import { lookup } from './locales'
import { i18nState } from './state'

// Quelle der Wahrheit für alle Schlüssel ist locales/en.json (Block site).
// Platzhalter: {name} (mit tf()), {{name}} bleibt unverändert (Template-Syntax der Settings).
export type TranslationKey = keyof typeof enJson.site

// Sprache des Prozesses (DEFAULT_LANGUAGE), wählbare Sprachen und Probleme beim Einlesen.
export const lang: string = i18nState.language
export const availableLanguages: string[] = i18nState.available
export const localeProblems: string[] = i18nState.problems

// Wörterbuch der Statusseite für den Client-Kontext.
export function getSiteDictionary(): Record<string, string> {
  return i18nState.site
}

export function t(key: TranslationKey): string {
  return lookup(i18nState.site, key) ?? key
}

// Text mit Platzhaltern der Form {name}: tf('footer.timezone', { timezone: 'UTC' })
export function tf(key: TranslationKey, vars: Record<string, string | number>): string {
  return t(key).replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m))
}
