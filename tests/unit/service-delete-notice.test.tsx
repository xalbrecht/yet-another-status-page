import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { ServiceDeleteNoticeView } from '@/components/admin/ServiceDeleteNoticeView'
import { withAdminText } from './i18n-helpers'

const render = (props: Parameters<typeof ServiceDeleteNoticeView>[0]) => renderToStaticMarkup(withAdminText(<ServiceDeleteNoticeView {...props} />))

test('aktiver Dienst ohne Ende: Hinweis nennt, dass erst ein Ende-Datum nötig ist', () => {
  const markup = render({ verdict: 'active', entries: 14, endsAtLabel: '' })
  assert.match(markup, /Dieser Dienst ist aktiv\./)
  assert.match(markup, /Ende-Datum/)
  assert.doesNotMatch(markup, /14/)
})

test('Ende in der Zukunft: Hinweis nennt den letzten aktiven Tag', () => {
  const markup = render({ verdict: 'ends-in-future', entries: 14, endsAtLabel: '31.12.2026' })
  assert.match(markup, /Das Ende liegt noch in der Zukunft\./)
  assert.match(markup, /bis einschließlich 31\.12\.2026/)
})

test('beendeter Dienst: Hinweis nennt die Zahl der Einträge und die Folgen für den Bericht', () => {
  const markup = render({ verdict: 'ended', entries: 14, endsAtLabel: '30.09.2026' })
  assert.match(markup, /Beim Löschen entfällt das Statusprotokoll\./)
  assert.match(markup, /14 Einträge/)
  assert.match(markup, /Verfügbarkeitsbericht/)
})

test('beendeter Dienst mit genau einem Eintrag: Einzahl', () => {
  const markup = render({ verdict: 'ended', entries: 1, endsAtLabel: '30.09.2026' })
  assert.match(markup, /1 Eintrag im Statusprotokoll/)
  assert.doesNotMatch(markup, /1 Einträge/)
})

test('beendeter Dienst, Zahl noch nicht geladen: kein falscher Wert', () => {
  const markup = render({ verdict: 'ended', entries: null, endsAtLabel: '30.09.2026' })
  assert.match(markup, /Beim Löschen entfällt das Statusprotokoll\./)
  assert.doesNotMatch(markup, /\b0 Einträge/)
})
