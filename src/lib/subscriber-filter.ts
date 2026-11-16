import type { Where } from 'payload'

/**
 * Abonnenten, die Meldungen erhalten dürfen.
 *
 * E-Mail: aktiv, vom Betreiber freigegeben (`verified`) und Adresse per Link bestätigt
 * (`addressConfirmed`). SMS: aktiv und vom Betreiber freigegeben. Die Telefonnummer selbst
 * bestätigt der Abonnent nicht, die Freigabe ist der einzige Schutz vor fremden Nummern.
 */
export function deliverableSubscribersWhere(type: 'email' | 'sms'): Where {
  if (type === 'sms') {
    return { and: [{ type: { equals: 'sms' } }, { active: { equals: true } }, { verified: { equals: true } }] }
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

/** Aktive Abonnenten, die noch keine Meldungen erhalten: E-Mail ohne Freigabe oder Bestätigung, SMS ohne Freigabe. */
export function pendingSubscribersWhere(): Where {
  return {
    and: [
      { active: { equals: true } },
      {
        or: [
          { and: [{ type: { equals: 'email' } }, { or: [{ verified: { not_equals: true } }, { addressConfirmed: { not_equals: true } }] }] },
          { and: [{ type: { equals: 'sms' } }, { verified: { not_equals: true } }] },
        ],
      },
    ],
  }
}
