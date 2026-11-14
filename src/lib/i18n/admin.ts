import deJson from '../../../locales/de.json' with { type: 'json' }
import { lang, type Lang } from './index'

// Texte der Admin-Oberfläche (Collections, Globals, Komponenten).
// Schlüssel ist der englische Originaltext (Block admin in locales/de.json).
// Fehlt ein Eintrag, bleibt der englische Text stehen.
// Hat derselbe englische Text zwei deutsche Fassungen, trägt die zweite den Schlüssel
// "Text|kontext", und die Aufrufstelle nennt den Zusatz: ta('Admin', 'role').
export function resolveAdminText(dict: Record<string, string>, language: Lang, en: string, context?: string): string {
  if (language !== 'de') return en
  return (context !== undefined ? dict[`${en}|${context}`] : undefined) ?? dict[en] ?? en
}

export function ta(en: string, context?: string): string {
  return resolveAdminText(deJson.admin, lang, en, context)
}
