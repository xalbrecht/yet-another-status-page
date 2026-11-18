import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { ServiceStateFilterView } from '@/components/admin/ServiceStateFilterView'
import { withAdminText } from './i18n-helpers'

const noop = () => {}
const render = (current: Parameters<typeof ServiceStateFilterView>[0]['current']) =>
  renderToStaticMarkup(withAdminText(<ServiceStateFilterView current={current} onChoose={noop} />))
const pressed = (markup: string) => [...markup.matchAll(/aria-pressed="true"[^>]*data-state="([^"]+)"/g)].map((match) => match[1])

test('vier Knöpfe in fester Reihenfolge mit deutschen Beschriftungen', () => {
  const markup = render(null)
  const labels = [...markup.matchAll(/<button[^>]*>([^<]+)<\/button>/g)].map((match) => match[1])
  assert.deepEqual(labels, ['Alle', 'Aktiv', 'Beendet', 'Noch nicht begonnen'])
  assert.ok(markup.includes('Betriebszeit'))
})

test('genau ein Knopf ist gewählt: ohne Zustandsfilter „Alle“, sonst der Zustand', () => {
  assert.deepEqual(pressed(render(null)), ['all'])
  assert.deepEqual(pressed(render('active')), ['active'])
  assert.deepEqual(pressed(render('ended')), ['ended'])
  assert.deepEqual(pressed(render('not-started')), ['not-started'])
})
