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
