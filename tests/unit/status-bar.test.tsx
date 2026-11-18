import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { StatusBar } from '@/components/status/lagebild/StatusBar'
import type { BarRun } from '@/lib/lagebild'
import { withI18n } from './i18n-helpers'

const window = { startMs: 0, slotMinutes: 5, slots: 144, nowMs: 0, locale: 'de-DE', timeZone: 'UTC', yesterday: 'gestern' }

const render = (runs: BarRun[]) =>
  renderToStaticMarkup(withI18n(<StatusBar runs={runs} window={window} label="Balken" />))

test('Balken zeichnet ein Element je Zustandsfolge, nicht je Strich', () => {
  const markup = render([
    { status: 'operational', slots: 100 },
    { status: 'major', slots: 4 },
    { status: null, slots: 40 },
  ])
  assert.equal(markup.split('data-run="').length - 1, 3)
  assert.match(markup, /data-slots="144"/)
  assert.match(markup, /data-run="100"[^>]*flex-grow:100/)
  assert.ok(!markup.includes('data-i='))
})

test('Balken mit ununterbrochenem Zustand ist ein einziges Element', () => {
  const markup = render([{ status: 'operational', slots: 144 }])
  assert.equal(markup.split('data-run="').length - 1, 1)
})
