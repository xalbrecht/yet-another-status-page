import type { Payload, Where } from 'payload'
import { notificationGroupIds } from '@/lib/access'

/**
 * Abonnenten, die Meldungen erhalten dürfen.
 *
 * E-Mail: aktiv, vom Betreiber freigegeben (`verified`) und Adresse per Link bestätigt
 * (`addressConfirmed`). SMS: aktiv und vom Betreiber freigegeben. Die Telefonnummer selbst
 * bestätigt der Abonnent nicht, die Freigabe ist der einzige Schutz vor fremden Nummern.
 * Mit `groupIds` zusätzlich nur Abonnenten mit „alle Dienstgruppen“ oder passender Auswahl.
 */
export function deliverableSubscribersWhere(type: 'email' | 'sms', groupIds?: number[]): Where {
  const conditions: Where[] =
    type === 'sms'
      ? [{ type: { equals: 'sms' } }, { active: { equals: true } }, { verified: { equals: true } }]
      : [
          { type: { equals: 'email' } },
          { active: { equals: true } },
          { verified: { equals: true } },
          { addressConfirmed: { equals: true } },
        ]
  // Gruppenwahl: „alle Dienstgruppen“ oder eine Auswahl mit mindestens einer Gruppe der Meldung
  if (groupIds && groupIds.length > 0) {
    conditions.push({ or: [{ allGroups: { equals: true } }, { groups: { in: groupIds } }] })
  }
  return { and: conditions }
}

/**
 * Dienstgruppen, nach denen eine Benachrichtigung zugestellt wird. Leere Liste, wenn sich die Gruppen nicht bestimmen
 * lassen (kein Bezug, keine Dienste, Bezugsobjekt fehlt oder ein Dienst ohne Gruppe): Dann erhalten alle Abonnenten die
 * Meldung, lieber eine Mail zu viel als eine verpasste Störung.
 */
export async function groupsForDelivery(
  payload: Payload,
  notification: { relatedIncident?: unknown; relatedMaintenance?: unknown },
): Promise<number[]> {
  return (await notificationGroupIds(payload, notification)) ?? []
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
