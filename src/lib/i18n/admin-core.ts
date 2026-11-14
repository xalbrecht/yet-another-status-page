import { lookup } from './locales'

// Bekannte Zusätze (Schlüssel "Text|zusatz" in der Sprachdatei). Ein neuer Zusatz wird hier ergänzt.
// Der Typ verhindert, dass ein alter Aufruf mit deutschem Text als zweitem Argument still kompiliert.
export type AdminTextContext = 'role' | 'log' | 'single'

// Texte der Admin-Oberfläche: Schlüssel ist der englische Originaltext (Block admin der Sprachdatei).
// Fehlt ein Eintrag, bleibt der englische Text stehen. Hat derselbe englische Text zwei Fassungen,
// trägt die zweite den Schlüssel "Text|kontext", und die Aufrufstelle nennt den Zusatz: ta('Admin', 'role').
// Läuft im Server und im Browser (kein Dateizugriff).
export function resolveAdminText(dict: Record<string, string>, en: string, context?: string): string {
  return (context !== undefined ? lookup(dict, `${en}|${context}`) : undefined) ?? lookup(dict, en) ?? en
}
