import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Notifications } from '@/collections/Notifications'
import { NTFY_TEXT_MAX_LENGTH } from '@/lib/message-templates'

type FieldLike = { name?: string; type?: string; required?: boolean; maxLength?: number; admin?: { condition?: unknown } }
const fieldsOf = (): FieldLike[] => Notifications.fields as FieldLike[]
const field = (name: string) => fieldsOf().find((f) => f.name === name)

test('die Benachrichtigung hat ein optionales Textfeld ntfyBody mit der Grenze der Vorlagen', () => {
  const ntfy = field('ntfyBody')
  assert.ok(ntfy, 'Feld ntfyBody fehlt')
  assert.equal(ntfy.type, 'textarea')
  assert.equal(ntfy.required ?? false, false)
  assert.equal(ntfy.maxLength, NTFY_TEXT_MAX_LENGTH)
  assert.equal(NTFY_TEXT_MAX_LENGTH, 500)
})

test('ntfyBody hängt nicht vom Kanal ab: Die lesende Anbindung nutzt es für jede gesendete Benachrichtigung', () => {
  assert.equal(field('ntfyBody')?.admin?.condition, undefined)
  // im Gegensatz zum SMS-Text, der nur bei den Kanälen E-Mail-frei sichtbar ist
  assert.notEqual(field('smsBody')?.admin?.condition, undefined)
})

test('die Felder emailBody und smsBody bleiben unverändert vorhanden', () => {
  assert.ok(field('emailBody'))
  assert.ok(field('smsBody'))
})
