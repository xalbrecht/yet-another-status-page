import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { StatusBoxes } from '@/components/status/StatusBoxes'
import { t, tf } from '@/lib/i18n'
import type { BoxContent, BoxItem } from '@/lib/status-boxes'

const item = (n: number, over: Partial<BoxItem> = {}): BoxItem => ({
  id: String(n),
  href: `/i/s${n}`,
  title: `Titel ${n}`,
  status: 'partial',
  stateLabel: 'Ursache gefunden',
  when: `Zeit ${n}`,
  services: ['Mail', 'Webmail'],
  last: `Letzter Stand ${n}`,
  ...over,
})
const items = (count: number) => Array.from({ length: count }, (_, i) => item(i + 1))

const render = (
  incidents: BoxItem[],
  maintenances: BoxItem[] = [],
  entries = 3,
  content: BoxContent = 'full',
) => renderToStaticMarkup(<StatusBoxes incidents={incidents} maintenances={maintenances} entries={entries} content={content} />)

const section = (markup: string, id: 'box-incidents' | 'box-maintenances') => {
  const start = markup.indexOf(`data-testid="${id}"`)
  assert.ok(start >= 0, `${id} fehlt`)
  return markup.slice(start, markup.indexOf('</section>', start))
}
const count = (markup: string, id: string) => markup.split(`data-testid="${id}"`).length - 1

test('vier Einträge bei entries 3 zeigen drei Einträge und einen Link auf die Langform', () => {
  const markup = render(items(4), items(4).map((i) => ({ ...i, href: `/m/s${i.id}` })))
  const incidents = section(markup, 'box-incidents')
  assert.equal(count(incidents, 'box-item'), 3)
  assert.match(incidents, new RegExp(`data-testid="box-more"[^>]*href="#incidents"|href="#incidents"[^>]*data-testid="box-more"`))
  assert.ok(incidents.includes(tf('statusBoxes.more', { count: 1 })))
  const maintenances = section(markup, 'box-maintenances')
  assert.equal(count(maintenances, 'box-item'), 3)
  assert.match(maintenances, /href="#maintenance"/)
})

test('genau entries Einträge ergeben keinen Rest-Link', () => {
  const markup = render(items(3), items(3))
  assert.equal(count(markup, 'box-more'), 0)
})

test('ohne Einträge steht der Satz und im Zähler die Zahl 0', () => {
  const markup = render([], [])
  assert.ok(markup.includes(t('statusBoxes.noIncidents')))
  assert.ok(markup.includes(t('statusBoxes.noMaintenances')))
  assert.equal(count(markup, 'box-item'), 0)
  assert.match(section(markup, 'box-incidents'), />0<\/span>/)
  assert.match(section(markup, 'box-maintenances'), />0<\/span>/)
})

test('der Zähler nennt alle Einträge, nicht nur die gezeigten', () => {
  assert.match(section(render(items(5)), 'box-incidents'), />5<\/span>/)
})

test('compact lässt Dienste und letzten Stand weg, Titel, Zustand und Zeit bleiben', () => {
  const markup = render(items(2), [], 3, 'compact')
  assert.equal(count(markup, 'box-service'), 0)
  assert.ok(!markup.includes('Letzter Stand'))
  assert.ok(markup.includes('Titel 1'))
  assert.ok(markup.includes('Ursache gefunden'))
  assert.ok(markup.includes('Zeit 1'))
})

test('full zeigt Dienste als Chips und den letzten Stand', () => {
  const markup = render(items(2), [], 3, 'full')
  assert.equal(count(markup, 'box-service'), 4)
  assert.ok(markup.includes('Letzter Stand 1'))
  assert.match(markup, /href="\/i\/s1"/)
})

test('last null und keine Dienste erzeugen keine leeren Elemente', () => {
  const markup = render([item(1, { last: null, services: [] })])
  assert.equal(count(markup, 'box-service'), 0)
  assert.ok(!/<p[^>]*><\/p>/.test(markup), 'leerer Absatz')
  assert.ok(!markup.includes('null'))
})
