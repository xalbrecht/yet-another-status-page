import deJson from '../../../locales/de.json' with { type: 'json' }
import enJson from '../../../locales/en.json' with { type: 'json' }

// Quelle der Wahrheit für alle Schlüssel ist locales/en.json (Block site).
// Platzhalter: {name} (mit tf()), {{name}} bleibt unverändert (Template-Syntax der Settings).
export type TranslationKey = keyof typeof enJson.site
export type Lang = 'de' | 'en'

const dictionaries: Record<Lang, Record<TranslationKey, string>> = { de: deJson.site, en: enJson.site }

// Sprache wird beim Build festgelegt (NEXT_PUBLIC_UI_LANG), Standard: Deutsch.
// Funktioniert dadurch identisch in Server- und Client-Komponenten.
const LANG: Lang = process.env.NEXT_PUBLIC_UI_LANG === 'en' ? 'en' : 'de'

export const lang: Lang = LANG

export function t(key: TranslationKey): string {
  return dictionaries[LANG][key] ?? enJson.site[key]
}

// Text mit Platzhaltern der Form {name}: tf('footer.timezone', { timezone: 'UTC' })
export function tf(key: TranslationKey, vars: Record<string, string | number>): string {
  return t(key).replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m))
}
