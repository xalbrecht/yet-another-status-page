import { lookup } from './locales'
import { i18nState } from './state'

// Texte der Admin-Oberfläche (Collections, Globals, Komponenten).
// Schlüssel ist der englische Originaltext (Block admin der Sprachdatei).
// Fehlt ein Eintrag, bleibt der englische Text stehen.
// Hat derselbe englische Text zwei Fassungen, trägt die zweite den Schlüssel
// "Text|kontext", und die Aufrufstelle nennt den Zusatz: ta('Admin', 'role').
export function resolveAdminText(dict: Record<string, string>, en: string, context?: string): string {
  return (context !== undefined ? lookup(dict, `${en}|${context}`) : undefined) ?? lookup(dict, en) ?? en
}

// Bekannte Zusätze (Schlüssel "Text|zusatz" in locales/de.json). Ein neuer Zusatz wird hier ergänzt.
// Der Typ verhindert, dass ein alter Aufruf mit deutschem Text als zweitem Argument still kompiliert.
export type AdminTextContext = 'role' | 'log' | 'single'

export function ta(en: string, context?: AdminTextContext): string {
  return resolveAdminText(i18nState.admin, en, context)
}
