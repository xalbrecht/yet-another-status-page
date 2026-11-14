import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { GroupTooltip } from '@/components/status/lagebild/GroupTooltip'
import { statusLabel } from '@/lib/lagebild'

const items = [
  { name: 'SMTP', status: 'partial' as const },
  { name: 'IMAP', status: 'operational' as const },
]

const render = (open: boolean, extra: { footer?: string; items?: unknown[] } = {}) =>
  renderToStaticMarkup(
    <GroupTooltip
      id="tip-1"
      title="Mail"
      items={(extra.items ?? items) as typeof items}
      footer={extra.footer}
      open={open}
      onEnter={() => {}}
      onLeave={() => {}}
      onActivate={() => {}}
    />,
  )

test('geschlossen steht die Liste der Dienste weiter im Markup', () => {
  const markup = render(false)
  assert.match(markup, /data-open="false"/)
  assert.ok(markup.includes('SMTP') && markup.includes('IMAP'))
})

test('geöffnet steht data-open auf true, die Rolle ist tooltip und die Id passt zu aria-describedby', () => {
  const markup = render(true)
  assert.match(markup, /data-open="true"/)
  assert.match(markup, /role="tooltip"/)
  assert.match(markup, /id="tip-1"/)
})

test('jeder Dienst hat einen Punkt für Sehende und einen Text mit dem Zustand für Screenreader', () => {
  const markup = render(true)
  assert.equal(markup.split('sr-only').length - 1, 2)
  assert.ok(markup.includes(`<span class="sr-only">${statusLabel('partial')}</span>`))
  assert.ok(markup.includes(`<span class="sr-only">${statusLabel('operational')}</span>`))
  assert.equal(markup.split('aria-hidden="true"').length - 1, 2)
})

test('Beschreibungstexte der Dienste erscheinen nicht', () => {
  const markup = render(true, { items: [{ name: 'SMTP', status: 'partial', description: 'Versendet Mail' }] })
  assert.ok(!markup.includes('Versendet Mail'))
})

test('eine Fußzeile erscheint nur, wenn sie übergeben wird', () => {
  assert.ok(render(true, { footer: '9 weitere Gruppen betriebsbereit' }).includes('9 weitere Gruppen betriebsbereit'))
  assert.ok(!render(true).includes('weitere Gruppen'))
})
