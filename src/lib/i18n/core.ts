import type { TranslationKey } from './index'
import { lookup } from './locales'

export type Translate = (key: TranslationKey) => string
export type TranslateFormat = (key: TranslationKey, vars: Record<string, string | number>) => string

// t() und tf() für ein Wörterbuch. Läuft im Server und im Browser (kein Dateizugriff).
// Platzhalter: {name} wird ersetzt, {{name}} (Template-Syntax der Settings) bleibt unverändert.
export function makeTranslators(dict: Record<string, string>): { t: Translate; tf: TranslateFormat } {
  const t: Translate = (key) => lookup(dict, key) ?? key
  const tf: TranslateFormat = (key, vars) =>
    t(key).replace(/\{(\w+)\}/g, (match, name) => (Object.hasOwn(vars, name) ? String(vars[name]) : match))
  return { t, tf }
}
