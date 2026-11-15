import { resolveAdminText, type AdminTextContext } from './admin-core'
import { i18nState } from './state'
import clientKeys from './admin-client-keys.json' with { type: 'json' }

export { resolveAdminText, type AdminTextContext }

// Wörterbuch des Admins für den Client-Kontext (AdminTextProvider). Nur die Texte, die Client-Komponenten
// brauchen (Liste aus `npm run generate:admin-client-keys`), nicht das ganze Wörterbuch.
let clientDictionary: Record<string, string> | undefined
export function getAdminDictionary(): Record<string, string> {
  clientDictionary ??= Object.fromEntries(
    clientKeys.flatMap((key) => (Object.hasOwn(i18nState.admin, key) ? [[key, i18nState.admin[key]]] : [])),
  )
  return clientDictionary
}

// Admin-Texte auf dem Server. Im Browser stattdessen useAdminText() aus admin-client.tsx.
export function ta(en: string, context?: AdminTextContext): string {
  return resolveAdminText(i18nState.admin, en, context)
}
