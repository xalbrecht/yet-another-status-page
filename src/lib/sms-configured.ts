/** SMS ist nutzbar: eingeschaltet, mit Twilio-Konto, Token und einem Absender (Nummer oder Messaging Service). */
export function isSmsConfigured(settings: {
  enabled?: boolean | null
  twilioAccountSid?: string | null
  twilioAuthToken?: string | null
  twilioFromNumber?: string | null
  twilioMessagingServiceSid?: string | null
}): boolean {
  return Boolean(
    settings.enabled &&
      settings.twilioAccountSid &&
      settings.twilioAuthToken &&
      (settings.twilioFromNumber || settings.twilioMessagingServiceSid),
  )
}

/** Telefonnummer mit Ländervorwahl, 7 bis 15 Ziffern, führendes Plus erlaubt. */
export const isValidPhone = (phone: unknown): phone is string => typeof phone === 'string' && /^\+?[1-9]\d{6,14}$/.test(phone)

/**
 * Grund, eine SMS-Anmeldung abzulehnen, in dieser Reihenfolge: SMS nicht eingerichtet (503), Nummer ungültig (400),
 * Nummer schon angemeldet (409). `null`: die Anmeldung wird angenommen.
 */
export function smsSubscriptionProblem(input: { configured: boolean; phone: unknown; exists: boolean }): { status: 503 | 400 | 409; key: 'api.smsUnavailable' | 'api.invalidPhone' | 'api.phoneExists' } | null {
  if (!input.configured) return { status: 503, key: 'api.smsUnavailable' }
  if (!isValidPhone(input.phone)) return { status: 400, key: 'api.invalidPhone' }
  if (input.exists) return { status: 409, key: 'api.phoneExists' }
  return null
}
