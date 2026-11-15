import test from 'node:test'
import assert from 'node:assert/strict'
import { translatorsFor } from '../../src/lib/i18n/translators'

// Die Standardtexte der SMS-Vorlagen stehen in der Sprachdatei (Issue #98).
const keys = ['notif.smsIncidentNew', 'notif.smsIncidentUpdate', 'notif.smsMaintNew', 'notif.smsMaintUpdate']

for (const lang of ['de', 'en']) {
  test(`SMS-Standardtexte in ${lang}: vier Vorlagen mit Platzhaltern`, () => {
    const { dictionary } = translatorsFor(lang)
    for (const key of keys) {
      assert.ok(dictionary[key], `${key} fehlt in ${lang}`)
      assert.match(dictionary[key], /\{\{siteName\}\}.*\{\{title\}\}.*\{\{url\}\}/, `${key} braucht siteName, title und url`)
    }
  })
}

test('SMS-Standardtexte unterscheiden sich zwischen de und en', () => {
  assert.notEqual(translatorsFor('de').t('notif.smsIncidentNew'), translatorsFor('en').t('notif.smsIncidentNew'))
})
