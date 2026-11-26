import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { IncidentTimeline, IncidentTimelineWithLinks, type Incident } from '@/components/status/IncidentTimeline'
import { withI18n } from './i18n-helpers'

// Eine Störung mit je einem Update in allen vier Phasen (neueste zuerst, wie die Seiten sie liefern)
const incident: Incident = {
  id: '1',
  shortId: 'abc123',
  title: 'Störung Test',
  status: 'operational',
  updates: [
    { id: 'u4', status: 'resolved', message: 'm4', timestamp: '10:40' },
    { id: 'u3', status: 'monitoring', message: 'm3', timestamp: '10:30' },
    { id: 'u2', status: 'identified', message: 'm2', timestamp: '10:20' },
    { id: 'u1', status: 'investigating', message: 'm1', timestamp: '10:10' },
  ],
}

const names = ['Wird untersucht', 'Ursache gefunden', 'Wird beobachtet', 'Behoben']
const raw = ['Investigating', 'Identified', 'Monitoring', 'Resolved']

function check(html: string) {
  // Die Phasen stehen in der Kopfzeile eines Updates (Klasse `font-semibold`), nicht im Kartenkopf
  for (const name of names) assert.match(html, new RegExp(`font-semibold[^>]*>${name}<`), `${name} fehlt`)
  for (const word of raw) assert.doesNotMatch(html, new RegExp(word, 'i'), `${word} steht roh in der Ausgabe`)
}

test('Störungsliste mit Links (Startseite, Historie): Phasen deutsch', () => {
  const html = renderToStaticMarkup(
    withI18n(<IncidentTimelineWithLinks days={[{ date: '', dateSlug: 'x', incidents: [incident] }]} />),
  )
  check(html)
})

test('Störungsliste ohne Links: Phasen deutsch', () => {
  const html = renderToStaticMarkup(withI18n(<IncidentTimeline days={[{ date: '25.11.2026', incidents: [incident] }]} />))
  check(html)
})
