import { ta } from '@/lib/i18n/admin'

/**
 * Empfänger des Verfügbarkeitsberichts (Issue #65): ein Textfeld in den E-Mail-Einstellungen, Adressen durch Komma,
 * Semikolon oder Zeilenumbruch getrennt. Die Empfänger kommen nur von dort, nie aus einer Anfrage.
 */
const ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const entries = (text: string | null | undefined): string[] => (text ?? '').split(/[,;\n\r]+/).map((entry) => entry.trim()).filter(Boolean)

/** Adressen in Kleinbuchstaben ohne Duplikate, Reihenfolge der ersten Nennung. Prüft nicht auf Gültigkeit. */
export function parseRecipients(text: string | null | undefined): string[] {
  return Array.from(new Set(entries(text).map((entry) => entry.toLowerCase())))
}

/** `true` bei leerem Text oder lauter gültigen Adressen, sonst eine Meldung mit dem ersten ungültigen Eintrag. */
export function validateRecipients(text: string | null | undefined): true | string {
  const invalid = entries(text).find((entry) => !ADDRESS.test(entry))
  return invalid === undefined
    ? true
    : `${ta('Not a valid email address', 'Keine gültige E-Mail-Adresse')}: ${invalid}`
}
