import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { StatusLogView } from '@/components/admin/status-log/StatusLogView'

const rebuild = {
  dryRun: true,
  incidents: 165,
  counts: { major: 20, 'partial (nicht eindeutig)': 78 },
  reconstructedBefore: 431,
  reconstructedAfter: 432,
  unsure: 78,
  withoutService: 19,
}
const conversion = {
  dryRun: true,
  converted: [{ incidentId: '7', title: 'Wartung <script>alert(1)</script>', services: 2, from: '2026-10-12T18:00:00.000Z', to: '2026-10-12T20:10:00.000Z' }],
  skipped: [{ incidentId: '8', title: 'Wartung noch offen', reason: 'open' }],
}
const buttonTag = (markup: string, testId: string) => markup.match(new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>`))?.[0] ?? ''

test('zeigt die Zahlen der Vorschau der Nachrechnung', () => {
  const markup = renderToStaticMarkup(<StatusLogView rebuild={rebuild} conversion={null} busy={false} />)
  assert.match(markup, /432/)
  assert.match(markup, /431/)
  assert.match(markup, /78/)
  assert.match(markup, /19/)
})

test('listet umzuwandelnde und übersprungene Vorfälle, Titel werden maskiert', () => {
  const markup = renderToStaticMarkup(<StatusLogView rebuild={null} conversion={conversion} busy={false} />)
  assert.match(markup, /&lt;script&gt;/)
  assert.doesNotMatch(markup, /<script>alert/)
  assert.match(markup, /Wartung noch offen/)
  assert.match(markup, /offen/)
})

test('Ausführen ist erst nach einer Vorschau bedienbar', () => {
  const without = renderToStaticMarkup(<StatusLogView rebuild={null} conversion={null} busy={false} />)
  assert.match(buttonTag(without, 'rebuild-run'), /disabled/)
  assert.match(buttonTag(without, 'convert-run'), /disabled/)
  assert.doesNotMatch(buttonTag(without, 'rebuild-preview'), /disabled/)
  const withPreview = renderToStaticMarkup(<StatusLogView rebuild={rebuild} conversion={conversion} busy={false} />)
  assert.doesNotMatch(buttonTag(withPreview, 'rebuild-run'), /disabled/)
  assert.doesNotMatch(buttonTag(withPreview, 'convert-run'), /disabled/)
})

test('nach dem Ausführen ist Ausführen wieder gesperrt, bis eine neue Vorschau da ist', () => {
  const done = renderToStaticMarkup(<StatusLogView rebuild={{ ...rebuild, dryRun: false }} conversion={{ ...conversion, dryRun: false }} busy={false} />)
  assert.match(buttonTag(done, 'rebuild-run'), /disabled/)
  assert.match(buttonTag(done, 'convert-run'), /disabled/)
})

test('während einer Aktion sind alle Schaltflächen gesperrt', () => {
  const markup = renderToStaticMarkup(<StatusLogView rebuild={rebuild} conversion={conversion} busy={true} />)
  for (const id of ['rebuild-preview', 'rebuild-run', 'convert-preview', 'convert-run']) assert.match(buttonTag(markup, id), /disabled/)
})

test('die Zählung nach Einordnung steht mit lesbaren Namen statt mit internen Schlüsseln', () => {
  const markup = renderToStaticMarkup(<StatusLogView rebuild={rebuild} conversion={null} busy={false} />)
  assert.match(markup, /Major Outage|Schwerer Ausfall/)
  assert.doesNotMatch(markup, /<th>major<\/th>/)
  assert.doesNotMatch(markup, /<th>partial \(nicht eindeutig\)<\/th>/)
})

test('scheitert die Nachrechnung nach der Umwandlung, steht der Fehler mit der Aufforderung zum erneuten Ausführen da', () => {
  const markup = renderToStaticMarkup(
    <StatusLogView rebuild={null} conversion={{ ...conversion, dryRun: false, rebuildError: 'Datenbank nicht erreichbar' }} busy={false} />,
  )
  assert.match(markup, /data-testid="convert-rebuild-error"/)
  assert.match(markup, /Datenbank nicht erreichbar/)
})

test('der Grund „nach dem Start des Statusprotokolls erfasst“ wird lesbar angezeigt', () => {
  const markup = renderToStaticMarkup(
    <StatusLogView
      rebuild={null}
      conversion={{ dryRun: true, converted: [], skipped: [{ incidentId: '9', title: 'Störung nach Wartung', reason: 'after-start' }] }}
      busy={false}
    />,
  )
  assert.doesNotMatch(markup, />after-start</)
})
