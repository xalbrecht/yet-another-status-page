import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Subscribers } from '@/collections/Subscribers'

// Ein Abonnent mit leerem Wert in `all_groups` gilt weder als „alle Dienstgruppen“ noch hat er eine Auswahl und erhielte
// Meldungen mit Gruppenbezug nie (Issue #276). Das Feld ist deshalb Pflicht, die Spalte NOT NULL.

test('Feld allGroups ist ein Pflichtfeld mit Vorgabe „alle Dienstgruppen“', () => {
  const field = (Subscribers.fields as Array<{ name?: string; required?: boolean; defaultValue?: unknown }>).find((entry) => entry.name === 'allGroups')
  assert.ok(field, 'Feld allGroups fehlt')
  assert.equal(field.required, true)
  assert.equal(field.defaultValue, true)
})
