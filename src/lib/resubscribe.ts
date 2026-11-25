import type { Payload } from 'payload'
import { generateShortId } from '@/lib/shortId'

/**
 * Erneute Anmeldung eines Abonnenten, der sich abgemeldet hat (Eintrag mit `active = false`).
 * Der Eintrag wird wieder aktiviert und durchläuft Bestätigung und Freigabe von vorn wie eine Neuanmeldung:
 * `verified` (und bei E-Mail `addressConfirmed`) fallen zurück, der Bestätigungs-Token ist neu. Der Abmelde-Token
 * bleibt, damit Abmeldelinks in früheren Mails weiter gelten. Die Gruppenwahl der neuen Anmeldung ersetzt die alte.
 */
export async function reactivateSubscriber(
  payload: Payload,
  id: number | string,
  options: { type: 'email' | 'sms'; ipAddress: string; allGroups: boolean; groups: number[] },
) {
  return payload.update({
    collection: 'subscribers',
    id,
    data: {
      active: true,
      allGroups: options.allGroups,
      groups: options.groups,
      verified: false,
      ...(options.type === 'email' ? { addressConfirmed: false } : {}),
      verificationToken: generateShortId(24),
      ipAddress: options.ipAddress,
    },
  })
}
