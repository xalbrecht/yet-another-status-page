import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { ExportButtons } from '@/components/admin/availability-report/ExportButtons'

const hrefs = (markup: string) => [...markup.matchAll(/href="([^"]+)"/g)].map((match) => match[1].replace(/&amp;/g, '&'))

test('ohne Gruppe gibt es drei Links: ZIP, PDF und Excel', () => {
  const links = hrefs(renderToStaticMarkup(<ExportButtons search={{ period: '2026-10' }} groupId={null} />))
  assert.deepEqual(links, [
    '/api/availability-report/export?format=zip&period=2026-10',
    '/api/availability-report/export?format=pdf&period=2026-10',
    '/api/availability-report/export?format=xlsx&period=2026-10',
  ])
})

test('mit gewählter Gruppe kommt ein vierter Link nur für diese Gruppe', () => {
  const links = hrefs(renderToStaticMarkup(<ExportButtons search={{ period: '2026-10' }} groupId={7} />))
  assert.equal(links.length, 4)
  assert.ok(links[3].includes('format=zip&group=7'), links[3])
  assert.ok(!links[0].includes('group='))
})

test('die Auswahl wandert mit, Ansicht und Gruppe der Seite nicht', () => {
  const search = { period: 'custom', from: '2026-10-01', to: '2026-10-20', calc: 'monthly', maintenance: 'B', view: 'groups', group: '7', topN: '7' }
  for (const link of hrefs(renderToStaticMarkup(<ExportButtons search={search} groupId={null} />))) {
    assert.ok(link.includes('calc=monthly') && link.includes('maintenance=B') && link.includes('from=2026-10-01') && link.includes('to=2026-10-20'), link)
    assert.ok(!link.includes('view=') && !link.includes('group=') && !link.includes('topN='), link)
  }
})

test('die Links tragen das Attribut download', () => {
  const markup = renderToStaticMarkup(<ExportButtons search={{}} groupId={3} />)
  assert.equal((markup.match(/<a [^>]*download/g) ?? []).length, 4)
})
