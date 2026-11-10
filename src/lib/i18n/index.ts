import { de } from './de'
import { en, type TranslationKey } from './en'

export type { TranslationKey }
export type Lang = 'de' | 'en'

const dictionaries: Record<Lang, Record<TranslationKey, string>> = { de, en }

// Sprache wird beim Build festgelegt (NEXT_PUBLIC_UI_LANG), Standard: Deutsch.
// Funktioniert dadurch identisch in Server- und Client-Komponenten.
const LANG: Lang = process.env.NEXT_PUBLIC_UI_LANG === 'en' ? 'en' : 'de'

export const lang: Lang = LANG

export function t(key: TranslationKey): string {
  return dictionaries[LANG][key] ?? en[key]
}

// Text mit Platzhaltern der Form {name}: tf('footer.timezone', { timezone: 'UTC' })
export function tf(key: TranslationKey, vars: Record<string, string | number>): string {
  return t(key).replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m))
}
