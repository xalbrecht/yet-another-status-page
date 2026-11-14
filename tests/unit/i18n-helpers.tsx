import type { ReactElement, ReactNode } from 'react'
import { I18nProvider } from '../../src/lib/i18n/client'
import { AdminTextProvider } from '../../src/lib/i18n/admin-client'
import deJson from '../../locales/de.json' with { type: 'json' }

// Umhüllt eine Komponente mit dem eingebauten deutschen Wörterbuch (wie die Komponententests bisher erwarten).
export function withI18n(node: ReactNode): ReactElement {
  return <I18nProvider dictionary={deJson.site}>{node}</I18nProvider>
}

// Wie withI18n, für Admin-Komponenten (Block admin des eingebauten deutschen Wörterbuchs).
export function withAdminText(node: ReactNode): ReactElement {
  return <AdminTextProvider dictionary={deJson.admin}>{node}</AdminTextProvider>
}
