import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatDateTime } from '@/lib/datetime'
import { translatorsFor } from '@/lib/i18n/translators'
import { maintenanceNoticeTextFor, type NoticeMaintenance } from '@/lib/maintenance-notice'

const NOW = new Date('2026-11-19T12:00:00Z').getTime()
const dt = { timezone: 'UTC', locale: 'de-DE', weekStartsOn: 'monday' as const }
const de = translatorsFor('de')
const at = (iso: string) => formatDateTime(new Date(iso), dt)

function maintenance(overrides: Partial<NoticeMaintenance> = {}): NoticeMaintenance {
  return {
    status: 'in_progress',
    scheduledStartAt: '2026-11-19T10:00:00Z',
    scheduledEndAt: '2026-11-19T18:00:00Z',
    serviceIds: ['1'],
    affectsService: false,
    ...overrides,
  }
}

test('Hinweistext: laufende Wartung mit Ende', () => {
  const text = maintenanceNoticeTextFor([maintenance()], '1', NOW, dt, de)
  assert.equal(text, `Wartung bis ${at('2026-11-19T18:00:00Z')}`)
})

test('Hinweistext: laufende Wartung mit Auswirkung nennt die Einschränkung', () => {
  const text = maintenanceNoticeTextFor([maintenance({ affectsService: true })], '1', NOW, dt, de)
  assert.equal(text, `Wartung bis ${at('2026-11-19T18:00:00Z')}, eingeschränkt verfügbar`)
})

test('Hinweistext: ohne Ende und mit Auswirkung', () => {
  const text = maintenanceNoticeTextFor([maintenance({ scheduledEndAt: null, affectsService: true })], '1', NOW, dt, de)
  assert.equal(text, 'Wartung, eingeschränkt verfügbar')
})

test('Hinweistext: ohne Ende und ohne Auswirkung', () => {
  assert.equal(maintenanceNoticeTextFor([maintenance({ scheduledEndAt: null })], '1', NOW, dt, de), 'Wartung')
})

test('Hinweistext: bevorstehende Wartung nennt Beginn und Ende', () => {
  const text = maintenanceNoticeTextFor(
    [maintenance({ status: 'upcoming', scheduledStartAt: '2026-11-19T14:00:00Z', scheduledEndAt: '2026-11-19T15:00:00Z' })],
    '1',
    NOW,
    dt,
    de,
  )
  assert.equal(text, `Wartung ${at('2026-11-19T14:00:00Z')} – ${at('2026-11-19T15:00:00Z')}`)
})

test('Hinweistext: anderer Dienst oder abgeschlossene Wartung ergibt keinen Text', () => {
  assert.equal(maintenanceNoticeTextFor([maintenance()], '2', NOW, dt, de), undefined)
  assert.equal(maintenanceNoticeTextFor([maintenance({ status: 'completed' })], '1', NOW, dt, de), undefined)
})
