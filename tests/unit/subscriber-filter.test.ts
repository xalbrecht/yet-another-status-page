import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deliverableSubscribersWhere, pendingSubscribersWhere } from '@/lib/subscriber-filter'
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
