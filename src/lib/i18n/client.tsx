'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { makeTranslators, type Translate, type TranslateFormat } from './core'

type Translators = { t: Translate; tf: TranslateFormat }

const I18nContext = createContext<Translators | null>(null)

// Stellt das Wörterbuch der Statusseite für Client-Komponenten bereit. Das Wurzel-Layout füllt es
// auf dem Server (getSiteDictionary), damit Server und Browser denselben Text zeigen.
export function I18nProvider({ dictionary, children }: { dictionary: Record<string, string>; children: ReactNode }) {
  const translators = useMemo(() => makeTranslators(dictionary), [dictionary])
  return <I18nContext.Provider value={translators}>{children}</I18nContext.Provider>
}

export function useTranslation(): Translators {
  const translators = useContext(I18nContext)
  if (!translators) throw new Error('useTranslation braucht einen I18nProvider im Layout (src/lib/i18n/client.tsx)')
  return translators
}
