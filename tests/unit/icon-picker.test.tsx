import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { GroupIconGrid } from '@/components/admin/group-icon-field/GroupIconGrid'
import { GROUP_ICON_NAMES } from '@/lib/group-icons'
import { nextIconIndex, selectedIconIndex } from '@/lib/icon-picker'

const options = [
  { label: 'Generisch', value: 'LayoutGrid' },
  { label: 'Server', value: 'Server' },
  { label: 'Datenbank', value: 'Database' },
]

test('nextIconIndex: Pfeiltasten wechseln und springen am Rand herum, Pos1 und Ende, andere Tasten nichts', () => {
  assert.equal(nextIconIndex('ArrowRight', 0, 3), 1)
  assert.equal(nextIconIndex('ArrowDown', 2, 3), 0)
  assert.equal(nextIconIndex('ArrowLeft', 0, 3), 2)
  assert.equal(nextIconIndex('ArrowUp', 1, 3), 0)
  assert.equal(nextIconIndex('Home', 2, 3), 0)
  assert.equal(nextIconIndex('End', 0, 3), 2)
  assert.equal(nextIconIndex('a', 0, 3), null)
  assert.equal(nextIconIndex('ArrowRight', 0, 0), null)
})

test('selectedIconIndex: unbekannter oder leerer Wert führt auf den ersten Eintrag', () => {
  assert.equal(selectedIconIndex(['A', 'B', 'C'], 'B'), 1)
  assert.equal(selectedIconIndex(['A', 'B', 'C'], 'X'), 0)
  assert.equal(selectedIconIndex(['A', 'B', 'C'], null), 0)
})

test('das Raster zeigt jedes Symbol mit Namen, genau eines ist gewählt und per Tab erreichbar', () => {
  const markup = renderToStaticMarkup(<GroupIconGrid options={options} value="Server" label="Symbol" onSelect={() => {}} />)
  assert.equal(markup.split('role="radio"').length - 1, 3)
  assert.equal(markup.split('aria-checked="true"').length - 1, 1)
  assert.match(markup, /<button[^>]*data-testid="group-icon-Server"[^>]*aria-checked="true"|aria-checked="true"[^>]*data-testid="group-icon-Server"/)
  assert.equal(markup.split('tabindex="0"').length - 1, 1)
  for (const option of options) assert.ok(markup.includes(`>${option.label}</span>`), option.label)
  assert.match(markup, /role="radiogroup"[^>]*aria-label="Symbol"|aria-label="Symbol"[^>]*role="radiogroup"/)
})

test('das Raster kennt alle Symbole der Gruppen und sperrt bei readOnly', () => {
  const all = GROUP_ICON_NAMES.map((name) => ({ label: name, value: name }))
  const markup = renderToStaticMarkup(<GroupIconGrid options={all} value="LayoutGrid" label="Symbol" disabled onSelect={() => {}} />)
  assert.equal(markup.split('role="radio"').length - 1, GROUP_ICON_NAMES.length)
  assert.equal(markup.split('disabled=""').length - 1, GROUP_ICON_NAMES.length)
  assert.equal(markup.split('<svg').length - 1, GROUP_ICON_NAMES.length)
})
