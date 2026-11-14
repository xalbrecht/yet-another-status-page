import { resolveAdminText, type AdminTextContext } from './admin-core'
import { i18nState } from './state'

export { resolveAdminText, type AdminTextContext }

// Wörterbuch des Admins für den Client-Kontext (AdminTextProvider).
export function getAdminDictionary(): Record<string, string> {
  return i18nState.admin
}

// Admin-Texte auf dem Server. Im Browser stattdessen useAdminText() aus admin-client.tsx.
export function ta(en: string, context?: AdminTextContext): string {
  return resolveAdminText(i18nState.admin, en, context)
}
