import { test } from 'node:test'
import assert from 'node:assert/strict'
import { translatorsFor } from '@/lib/i18n/translators'
import { maintenanceBarText } from '@/lib/maintenance-notice'

const de = translatorsFor('de').tf
const en = translatorsFor('en').tf

test('Wartungsleiste: alle Dienste ohne Einschränkung', () => {
  assert.equal(maintenanceBarText({ unaffected: 2, limited: 0 }, de), 'Wartungsarbeiten laufen: 2 Dienste ohne Einschränkung')
})

test('Wartungsleiste: gemischt, „ohne Einschränkung“ steht vor „mit erwarteten Einschränkungen“', () => {
  assert.equal(
    maintenanceBarText({ unaffected: 1, limited: 1 }, de),
    'Wartungsarbeiten laufen: 1 Dienst ohne Einschränkung, 1 Dienst mit erwarteten Einschränkungen',
  )
})

test('Wartungsleiste: nur Dienste mit Einschränkung, Mehrzahl', () => {
  assert.equal(maintenanceBarText({ unaffected: 0, limited: 3 }, de), 'Wartungsarbeiten laufen: 3 Dienste mit erwarteten Einschränkungen')
})

test('Wartungsleiste: ohne Dienste keine Leiste', () => {
  assert.equal(maintenanceBarText({ unaffected: 0, limited: 0 }, de), null)
})

test('Wartungsleiste: Einzahl und Mehrzahl auch auf Englisch', () => {
  assert.equal(maintenanceBarText({ unaffected: 1, limited: 2 }, en), 'Maintenance in progress: 1 service without restrictions, 2 services with expected restrictions')
})

test('Marke: Text bei Auswirkung mit und ohne Ende', () => {
  assert.equal(de('maintenance.noticeRunningLimited', { end: '18:00' }), 'Wartung bis 18:00, eingeschränkt verfügbar')
  assert.equal(de('maintenance.noticeRunningOpenLimited', {}), 'Wartung, eingeschränkt verfügbar')
  assert.equal(en('maintenance.noticeRunningLimited', { end: '6:00 PM' }), 'Maintenance until 6:00 PM, restricted availability')
  assert.equal(en('maintenance.noticeRunningOpenLimited', {}), 'Maintenance, restricted availability')
})
