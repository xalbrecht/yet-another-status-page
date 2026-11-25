import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import { deliverableSubscribersWhere, groupsForDelivery, pendingSubscribersWhere } from '@/lib/subscriber-filter'
import { isSmsConfigured, smsSubscriptionProblem } from '@/lib/sms-configured'

test('E-Mail-Abonnenten: aktiv, freigegeben und Adresse bestätigt', () => {
  assert.deepEqual(deliverableSubscribersWhere('email'), {
    and: [{ type: { equals: 'email' } }, { active: { equals: true } }, { verified: { equals: true } }, { addressConfirmed: { equals: true } }],
  })
})

test('SMS-Abonnenten: aktiv und freigegeben, ohne Bestätigung der Nummer', () => {
  assert.deepEqual(deliverableSubscribersWhere('sms'), {
    and: [{ type: { equals: 'sms' } }, { active: { equals: true } }, { verified: { equals: true } }],
  })
})

test('wartende Abonnenten: E-Mail ohne Freigabe oder Bestätigung, SMS ohne Freigabe', () => {
  assert.deepEqual(pendingSubscribersWhere(), {
    and: [
      { active: { equals: true } },
      {
        or: [
          { and: [{ type: { equals: 'email' } }, { or: [{ verified: { not_equals: true } }, { addressConfirmed: { not_equals: true } }] }] },
          { and: [{ type: { equals: 'sms' } }, { verified: { not_equals: true } }] },
        ],
      },
    ],
  })
})

const twilio = { enabled: true, twilioAccountSid: 'AC1', twilioAuthToken: 'geheim', twilioFromNumber: '+15550100' }

test('isSmsConfigured: eingeschaltet, mit Konto, Token und Absender', () => {
  assert.equal(isSmsConfigured(twilio), true)
  assert.equal(isSmsConfigured({ ...twilio, twilioFromNumber: null, twilioMessagingServiceSid: 'MG1' }), true)
})

test('isSmsConfigured: ausgeschaltet oder unvollständig ergibt false', () => {
  assert.equal(isSmsConfigured({ ...twilio, enabled: false }), false)
  assert.equal(isSmsConfigured({ ...twilio, twilioAccountSid: '' }), false)
  assert.equal(isSmsConfigured({ ...twilio, twilioAuthToken: null }), false)
  assert.equal(isSmsConfigured({ ...twilio, twilioFromNumber: null }), false)
  assert.equal(isSmsConfigured({}), false)
})

test('SMS-Anmeldung: nicht eingerichtet ergibt 503, auch bei gültiger Nummer', () => {
  assert.deepEqual(smsSubscriptionProblem({ configured: false, phone: '+4915112345678', exists: false }), { status: 503, key: 'api.smsUnavailable' })
})

test('SMS-Anmeldung: ungültige oder fehlende Nummer ergibt 400', () => {
  for (const phone of ['0151-123', '+0151123456', '12345', '', undefined, 4915112345678]) {
    assert.deepEqual(smsSubscriptionProblem({ configured: true, phone, exists: false }), { status: 400, key: 'api.invalidPhone' }, String(phone))
  }
})

test('SMS-Anmeldung: schon angemeldete Nummer ergibt 409, eine neue wird angenommen', () => {
  assert.deepEqual(smsSubscriptionProblem({ configured: true, phone: '+4915112345678', exists: true }), { status: 409, key: 'api.phoneExists' })
  assert.equal(smsSubscriptionProblem({ configured: true, phone: '+4915112345678', exists: false }), null)
  assert.equal(smsSubscriptionProblem({ configured: true, phone: '4915112345678', exists: false }), null)
})

test('mit Gruppen: „alle“ oder Auswahl mit mindestens einer Gruppe der Meldung', () => {
  const where = deliverableSubscribersWhere('email', [3, 5])
  const conditions = (where as { and: unknown[] }).and
  assert.deepEqual(conditions[conditions.length - 1], { or: [{ allGroups: { equals: true } }, { groups: { in: [3, 5] } }] })
  const sms = (deliverableSubscribersWhere('sms', [3]) as { and: unknown[] }).and
  assert.deepEqual(sms[sms.length - 1], { or: [{ allGroups: { equals: true } }, { groups: { in: [3] } }] })
})

test('ohne Gruppen oder mit leerer Liste bleibt die Bedingung unverändert', () => {
  assert.deepEqual(deliverableSubscribersWhere('email', []), deliverableSubscribersWhere('email'))
  assert.deepEqual(deliverableSubscribersWhere('sms', undefined), deliverableSubscribersWhere('sms'))
})

// Fake-Payload: Störungen 1 (Dienste 10, 11), 2 (Dienst 12 ohne Gruppe), Dienste mit Gruppen 10→1, 11→2
const fakePayload = {
  findByID: async ({ collection, id }: { collection: string; id: string }) => {
    if (collection === 'incidents' && String(id) === '1') return { id: 1, affectedServices: [10, 11] }
    if (collection === 'incidents' && String(id) === '2') return { id: 2, affectedServices: [12] }
    if (collection === 'maintenances' && String(id) === '3') return { id: 3, affectedServices: [10] }
    return null
  },
  find: async ({ where }: { where: { id: { in: string[] } } }) => {
    const groups: Record<string, number | null> = { '10': 1, '11': 2, '12': null }
    return { docs: where.id.in.map((id) => ({ id, group: groups[id] })) }
  },
} as unknown as Payload

test('Gruppen der Meldung: Gruppen der Dienste, ohne Bezug leer, unklare Gruppe leer', async () => {
  assert.deepEqual((await groupsForDelivery(fakePayload, { relatedIncident: 1 })).sort(), [1, 2])
  assert.deepEqual(await groupsForDelivery(fakePayload, { relatedMaintenance: 3 }), [1])
  assert.deepEqual(await groupsForDelivery(fakePayload, {}), [])
  assert.deepEqual(await groupsForDelivery(fakePayload, { relatedIncident: 2 }), [])
  assert.deepEqual(await groupsForDelivery(fakePayload, { relatedIncident: 99 }), [])
})
