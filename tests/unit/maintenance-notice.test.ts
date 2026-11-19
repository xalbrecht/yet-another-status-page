import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Maintenances } from '@/collections/Maintenances'
import {
  MAINTENANCE_NOTICE_LEAD_MS,
  countMaintenanceServices,
  maintenanceNoticeFor,
  noticeMaintenanceWhere,
  runningMaintenanceServiceIds,
  toNoticeMaintenance,
  type NoticeMaintenance,
} from '@/lib/maintenance-notice'

const NOW = new Date('2026-11-19T12:00:00Z').getTime()

function maintenance(overrides: Partial<NoticeMaintenance> & { serviceIds: string[] }): NoticeMaintenance {
  return {
    status: 'in_progress',
    scheduledStartAt: '2026-11-19T10:00:00Z',
    scheduledEndAt: '2026-11-19T18:00:00Z',
    ...overrides,
  }
}

type Field = { name?: string; type?: string; defaultValue?: unknown }

test('Auswirkung auf den Dienst: Kontrollkästchen an der Wartung, Vorgabe „nein“', () => {
  const field = (Maintenances.fields as Field[]).find((entry) => entry.name === 'affectsService')
  assert.ok(field, 'Feld affectsService fehlt an der Wartung')
  assert.equal(field.type, 'checkbox')
  assert.equal(field.defaultValue, false)
})

test('Marke: meldet die Auswirkung der laufenden Wartung mit', () => {
  const withImpact = [maintenance({ serviceIds: ['1'], affectsService: true })]
  const withoutImpact = [maintenance({ serviceIds: ['1'] })]
  assert.equal(maintenanceNoticeFor(withImpact, '1', NOW)?.affectsService, true)
  assert.equal(maintenanceNoticeFor(withoutImpact, '1', NOW)?.affectsService, false)
})

test('Marke: bei laufender Wartung mit und ohne Auswirkung gilt die mit Auswirkung', () => {
  const both = [
    maintenance({ serviceIds: ['1'], scheduledStartAt: '2026-11-19T09:00:00Z' }),
    maintenance({ serviceIds: ['1'], scheduledStartAt: '2026-11-19T11:00:00Z', affectsService: true }),
  ]
  assert.equal(maintenanceNoticeFor(both, '1', NOW)?.affectsService, true)
})

test('Zählung: Dienste mit und ohne erwartete Einschränkung', () => {
  const list = [
    maintenance({ serviceIds: ['1'], affectsService: true }),
    maintenance({ serviceIds: ['2', '3'] }),
  ]
  assert.deepEqual(countMaintenanceServices(list, ['1', '2', '3', '4']), { unaffected: 2, limited: 1 })
})

test('Zählung: ein Dienst in zwei Wartungen zählt einmal, mit Einschränkung vor ohne', () => {
  const list = [
    maintenance({ serviceIds: ['1'] }),
    maintenance({ serviceIds: ['1'], affectsService: true }),
  ]
  assert.deepEqual(countMaintenanceServices(list, ['1']), { unaffected: 0, limited: 1 })
})

test('Zählung: nur laufende Wartungen zählen, bevorstehende, abgeschlossene und abgesagte nicht', () => {
  const list = [
    maintenance({ serviceIds: ['1'], status: 'upcoming', scheduledStartAt: '2026-11-19T13:00:00Z' }),
    maintenance({ serviceIds: ['2'], status: 'completed' }),
    maintenance({ serviceIds: ['3'], status: 'cancelled' }),
  ]
  assert.deepEqual(countMaintenanceServices(list, ['1', '2', '3']), { unaffected: 0, limited: 0 })
})

test('Zählung: Dienste, die es nicht mehr gibt, zählen nicht', () => {
  const list = [maintenance({ serviceIds: ['1', '99'] })]
  assert.deepEqual(countMaintenanceServices(list, ['1']), { unaffected: 1, limited: 0 })
})

test('Zählung: laufende Wartung ohne betroffene Dienste ergibt keine Zahlen', () => {
  const list = [maintenance({ serviceIds: [] })]
  assert.deepEqual(countMaintenanceServices(list, ['1', '2']), { unaffected: 0, limited: 0 })
})

test('Abfrage: laufende Wartungen unabhängig vom Beginn, bevorstehende nur innerhalb der Vorlaufzeit', () => {
  const limit = new Date(NOW + MAINTENANCE_NOTICE_LEAD_MS).toISOString()
  assert.deepEqual(noticeMaintenanceWhere(NOW), {
    or: [
      { status: { equals: 'in_progress' } },
      { and: [{ status: { equals: 'upcoming' } }, { scheduledStartAt: { less_than_equal: limit } }] },
    ],
  })
})

test('Dienste in laufender Wartung: nur der gelesene Status „In Arbeit“ zählt, alle Wartungen zusammen', () => {
  const list = [
    maintenance({ serviceIds: ['1', '2'] }),
    maintenance({ serviceIds: ['2', '3'], affectsService: true }),
    maintenance({ serviceIds: ['4'], status: 'upcoming' }),
    maintenance({ serviceIds: ['5'], status: 'completed' }),
    maintenance({ serviceIds: ['6'], status: 'cancelled' }),
  ]
  assert.deepEqual([...runningMaintenanceServiceIds(list)].sort(), ['1', '2', '3'])
  assert.equal(runningMaintenanceServiceIds([]).size, 0)
})

test('Umwandlung einer Wartung: Dienste als Ids, fehlende Auswirkung und fehlendes Ende', () => {
  const notice = toNoticeMaintenance({
    status: 'in_progress',
    scheduledStartAt: '2026-11-19T10:00:00Z',
    scheduledEndAt: null,
    affectsService: null,
    affectedServices: [7, { id: 8 }],
  })
  assert.deepEqual(notice, {
    status: 'in_progress',
    scheduledStartAt: '2026-11-19T10:00:00Z',
    scheduledEndAt: null,
    affectsService: false,
    serviceIds: ['7', '8'],
  })
  assert.equal(toNoticeMaintenance({ status: 'upcoming', scheduledStartAt: 'x', affectsService: true }).affectsService, true)
  assert.deepEqual(toNoticeMaintenance({ status: 'upcoming', scheduledStartAt: 'x' }).serviceIds, [])
})
