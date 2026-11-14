'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { resolveAdminText, type AdminTextContext } from './admin-core'

export type AdminText = (en: string, context?: AdminTextContext) => string

const AdminTextContextValue = createContext<AdminText | null>(null)

// Stellt das Wörterbuch des Admins für Client-Komponenten bereit (Layout von Payload, siehe src/app/(payload)/layout.tsx).
export function AdminTextProvider({ dictionary, children }: { dictionary: Record<string, string>; children: ReactNode }) {
  const ta = useMemo<AdminText>(() => (en, context) => resolveAdminText(dictionary, en, context), [dictionary])
  return <AdminTextContextValue.Provider value={ta}>{children}</AdminTextContextValue.Provider>
}

export function useAdminText(): AdminText {
  const ta = useContext(AdminTextContextValue)
  if (!ta) throw new Error('useAdminText braucht einen AdminTextProvider im Layout (src/app/(payload)/layout.tsx)')
  return ta
}
