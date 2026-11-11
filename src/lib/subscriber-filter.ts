import type { Where } from 'payload'

/**
 * Abonnenten, die Meldungen erhalten dürfen.
 *
 * E-Mail: aktiv, vom Betreiber freigegeben (`verified`) und Adresse per Link bestätigt
 * (`addressConfirmed`). SMS: nur aktiv (es gibt keinen SMS-Bestätigungsweg,
 * neue SMS-Anmeldungen lehnt `POST /api/subscribe` ab).
 */
export function deliverableSubscribersWhere(type: 'email' | 'sms'): Where {
  if (type === 'sms') {
    return { and: [{ type: { equals: 'sms' } }, { active: { equals: true } }] }
  }
  return {
    and: [
      { type: { equals: 'email' } },
      { active: { equals: true } },
      { verified: { equals: true } },
      { addressConfirmed: { equals: true } },
    ],
  }
}
