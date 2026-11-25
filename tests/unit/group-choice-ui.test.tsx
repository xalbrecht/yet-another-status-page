import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { GroupChoice, filterGroups, isGroupChoiceValid } from '@/components/status/GroupChoice'
import { withI18n } from './i18n-helpers'

const groups = [
  { id: 1, name: 'Einwohnerwesen' },
  { id: 2, name: 'E-Mail und Kalender' },
  { id: 3, name: 'Netzwerk' },
]

const render = (value: { allGroups: boolean; groups: number[] }) =>
  renderToStaticMarkup(withI18n(<GroupChoice groups={groups} value={value} onChange={() => {}} idPrefix="t" />))

test('mit „alle Dienstgruppen“ ist der Haken gesetzt und die Liste fehlt', () => {
  const markup = render({ allGroups: true, groups: [] })
  assert.match(markup, /id="t-all"[^>]*checked/)
  assert.ok(markup.includes('Alle Dienstgruppen'))
  assert.ok(!markup.includes('Einwohnerwesen'))
})

test('ohne „alle Dienstgruppen“ steht die Liste mit der Auswahl und dem Zähler da', () => {
  const markup = render({ allGroups: false, groups: [2] })
  assert.ok(!/id="t-all"[^>]*checked/.test(markup))
  for (const group of groups) assert.ok(markup.includes(group.name), group.name)
  assert.ok(markup.includes('1 von 3 gewählt'))
  assert.equal((markup.match(/data-group="\d+"[^>]*checked/g) ?? []).length, 1)
})

test('ohne „alle Dienstgruppen“ und ohne Auswahl erscheint die Meldung', () => {
  const markup = render({ allGroups: false, groups: [] })
  assert.ok(markup.includes('Mindestens eine Dienstgruppe wählen'))
  assert.ok(!render({ allGroups: false, groups: [1] }).includes('Mindestens eine Dienstgruppe wählen'))
})

test('die Suche ignoriert Groß- und Kleinschreibung und Leerraum am Rand', () => {
  assert.deepEqual(filterGroups(groups, '  MAIL ').map((g) => g.id), [2])
  assert.deepEqual(filterGroups(groups, '').map((g) => g.id), [1, 2, 3])
  assert.deepEqual(filterGroups(groups, 'xyz'), [])
})

test('gültig ist „alle“ oder eine nicht leere Auswahl', () => {
  assert.equal(isGroupChoiceValid({ allGroups: true, groups: [] }), true)
  assert.equal(isGroupChoiceValid({ allGroups: false, groups: [1] }), true)
  assert.equal(isGroupChoiceValid({ allGroups: false, groups: [] }), false)
})
