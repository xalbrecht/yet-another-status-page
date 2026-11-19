import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Incidents } from '@/collections/Incidents'
import { Maintenances } from '@/collections/Maintenances'
import { checkIncidentInput } from '@/lib/incident-draft'
import { checkMaintenanceInput } from '@/lib/maintenance-draft'

type Field = { name?: string; type?: string; defaultValue?: unknown; fields?: Field[]; admin?: { condition?: unknown } }
const top = (fields: unknown, name: string) => (fields as Field[]).find((entry) => entry.name === name)
const inUpdates = (fields: unknown) => top(fields, 'updates')?.fields?.find((entry) => entry.name === 'createNotificationDraft')

test('Aktualisierung einer Wartung: Kontrollkästchen „Meldungsentwurf anlegen“, Vorgabe angehakt', () => {
  const field = inUpdates(Maintenances.fields)
  assert.ok(field, 'Feld createNotificationDraft fehlt an den Aktualisierungen der Wartung')
  assert.equal(field.type, 'checkbox')
  assert.equal(field.defaultValue, true)
})

test('Aktualisierung einer Störung: Kontrollkästchen „Meldungsentwurf anlegen“, Vorgabe angehakt', () => {
  const field = inUpdates(Incidents.fields)
  assert.ok(field, 'Feld createNotificationDraft fehlt an den Aktualisierungen der Störung')
  assert.equal(field.type, 'checkbox')
  assert.equal(field.defaultValue, true)
})

test('Wartung selbst: Kontrollkästchen für den Entwurf beim Anlegen, Vorgabe angehakt, nur beim Anlegen sichtbar', () => {
  const field = top(Maintenances.fields, 'createNotificationDraft')
  assert.ok(field, 'Feld createNotificationDraft fehlt an der Wartung')
  assert.equal(field.type, 'checkbox')
  assert.equal(field.defaultValue, true)
  assert.equal(typeof field.admin?.condition, 'function')
  const visible = field.admin!.condition as (data: Record<string, unknown>) => boolean
  assert.equal(visible({}), true, 'neue Wartung ohne id')
  assert.equal(visible({ id: 7 }), false, 'gespeicherte Wartung')
})

test('Störung selbst hat kein eigenes Feld: die erste Aktualisierung steuert den Entwurf', () => {
  assert.equal(top(Incidents.fields, 'createNotificationDraft'), undefined)
})

const maintenance = { title: 'T', message: 'M', maintenanceKind: 'sla', serviceIds: [1], start: '2026-11-25T21:00:00.000Z' }
const incident = { title: 'T', message: 'M', impact: 'partial', serviceIds: [1] }

test('checkMaintenanceInput: createNotificationDraft nur bei false im Ergebnis, ein Text wird abgewiesen', () => {
  const withoutFlag = checkMaintenanceInput(maintenance)
  assert.ok(withoutFlag.ok)
  assert.equal('createNotificationDraft' in withoutFlag.value, false)
  const asTrue = checkMaintenanceInput({ ...maintenance, createNotificationDraft: true })
  assert.ok(asTrue.ok)
  assert.equal('createNotificationDraft' in asTrue.value, false)
  const asFalse = checkMaintenanceInput({ ...maintenance, createNotificationDraft: false })
  assert.ok(asFalse.ok)
  assert.equal(asFalse.value.createNotificationDraft, false)
  assert.deepEqual(checkMaintenanceInput({ ...maintenance, createNotificationDraft: 'nein' }), { ok: false, errors: ['createNotificationDraft'] })
})

test('checkIncidentInput: createNotificationDraft nur bei false im Ergebnis, ein Text wird abgewiesen', () => {
  const withoutFlag = checkIncidentInput(incident)
  assert.ok(withoutFlag.ok)
  assert.equal('createNotificationDraft' in withoutFlag.value, false)
  const asFalse = checkIncidentInput({ ...incident, createNotificationDraft: false })
  assert.ok(asFalse.ok)
  assert.equal(asFalse.value.createNotificationDraft, false)
  assert.deepEqual(checkIncidentInput({ ...incident, createNotificationDraft: 'nein' }), { ok: false, errors: ['createNotificationDraft'] })
})
