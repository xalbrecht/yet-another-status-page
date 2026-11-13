import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { SendReportForm, type SendState } from '@/components/admin/availability-report/SendReportForm'
import { selectionQuery } from '@/lib/report/params'

const recipients = ['a@x.de', 'b@x.de']
const render = (state: SendState, list: string[] = recipients) => renderToStaticMarkup(<SendReportForm recipients={list} state={state} />)
const buttons = (markup: string) => [...markup.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((match) => match[1])
const HELP = /nicht nach dem Neuladen|not after reloading/

test('idle: Schaltfläche „Per Mail senden“ und der Hilfetext zum Neuladen', () => {
  const markup = render({ kind: 'idle' })
  assert.deepEqual(buttons(markup), ['Per Mail senden'])
  assert.match(markup, HELP)
})

test('confirm: nennt alle Empfänger und bietet „Jetzt senden“ und „Abbrechen“', () => {
  const markup = render({ kind: 'confirm' })
  assert.match(markup, /a@x\.de, b@x\.de/)
  assert.deepEqual(buttons(markup), ['Jetzt senden', 'Abbrechen'])
})

test('sending: alle Knöpfe gesperrt, Hinweis auf die Dauer', () => {
  const markup = render({ kind: 'sending' })
  assert.match(markup, /Versand läuft|dispatch is running/)
  assert.ok(!/<button(?![^>]*disabled)/.test(markup), 'ein Knopf ist nicht gesperrt')
})

test('ohne Empfänger: keine Schaltfläche, Hinweis mit Link auf die E-Mail-Einstellungen, kein Hilfetext', () => {
  const markup = render({ kind: 'idle' }, [])
  assert.deepEqual(buttons(markup), [])
  assert.match(markup, /Keine Empfänger|No recipients/)
  assert.match(markup, /href="\/admin\/globals\/email-settings"/)
  assert.doesNotMatch(markup, HELP)
})

test('eine Adresse mit < wird maskiert', () => {
  const markup = render({ kind: 'confirm' }, ['<script>@x.de'])
  assert.doesNotMatch(markup, /<script>/)
  assert.match(markup, /&lt;script&gt;/)
})

test('Fehler mitten im Versand: nennt die Zahl und bietet „Rest senden“ ab der nächsten Mail', () => {
  const markup = render({ kind: 'error', code: 'send-failed', message: 'Server nicht erreichbar', sent: 2, mails: 4, nextMail: 3 })
  assert.match(markup, /role="alert"/)
  assert.match(markup, /2 von 4 Mails sind raus, Mail 3 ist nicht angekommen: Server nicht erreichbar/)
  assert.deepEqual(buttons(markup), ['Rest senden (ab Mail 3 von 4)'])
  assert.match(markup, HELP)
})

test('Fehler ohne gesendete Mail: „Erneut senden“ statt „Rest senden“', () => {
  const markup = render({ kind: 'error', code: 'send-failed', message: 'Server nicht erreichbar', sent: 0, mails: 4, nextMail: 1 })
  assert.match(markup, /Es ging keine Mail raus: Server nicht erreichbar/)
  assert.deepEqual(buttons(markup), ['Erneut senden'])
})

test('geänderte Daten: erklärt den Grund und bietet nur „Neu senden“ an', () => {
  const markup = render({ kind: 'error', code: 'plan-changed', message: 'egal' })
  assert.match(markup, /Daten des Berichts geändert/)
  assert.match(markup, /Teil i von n/)
  assert.deepEqual(buttons(markup), ['Neu senden'])
})

test('running, too-large und no-smtp zeigen ihre Meldung ohne Knopf', () => {
  for (const code of ['running', 'too-large', 'no-smtp']) {
    const markup = render({ kind: 'error', code, message: `Meldung-${code}` })
    assert.match(markup, /role="alert"/, code)
    assert.deepEqual(buttons(markup), [], code)
  }
  assert.match(render({ kind: 'error', code: 'too-large', message: 'PDF und Excel sind zusammen 8.0 MB groß' }), /8\.0 MB/)
  assert.match(render({ kind: 'error', code: 'running', message: 'x' }), /bereits ein Versand|already running/)
})

test('done: Meldung in role="status"', () => {
  const markup = render({ kind: 'done', message: '4 Mails gesendet' })
  assert.match(markup, /role="status"[^>]*>[^<]*4 Mails gesendet/)
})

test('selectionQuery trägt nur Zeitraum, Rechenart und Wartungsart, alphabetisch', () => {
  assert.equal(
    selectionQuery({ period: 'custom', from: '2026-10-01', to: '2026-10-20', calc: 'monthly', maintenance: 'B', view: 'groups', group: '7', topN: '7' }),
    'calc=monthly&from=2026-10-01&maintenance=B&period=custom&to=2026-10-20',
  )
  assert.equal(selectionQuery({}), '')
})

test('scheitert „Rest senden“ erneut, zählt die Seite die Mails des ersten Versuchs mit', () => {
  const sofort = render({ kind: 'error', code: 'send-failed', message: 'Server weg', sent: 0, mails: 4, nextMail: 3 })
  assert.match(sofort, /2 von 4 Mails sind raus, Mail 3 ist nicht angekommen/)
  assert.deepEqual(buttons(sofort), ['Rest senden (ab Mail 3 von 4)'])
  const spaeter = render({ kind: 'error', code: 'send-failed', message: 'Server weg', sent: 1, mails: 4, nextMail: 4 })
  assert.match(spaeter, /3 von 4 Mails sind raus, Mail 4 ist nicht angekommen/)
})

test('ohne Antwort des Servers steht „Stand unbekannt“ statt „Es ging keine Mail raus“, ohne Knopf', () => {
  const markup = render({ kind: 'error', code: 'unknown-state', message: 'x' })
  assert.match(markup, /Stand unbekannt/)
  assert.match(markup, /Empfängern nachsehen|check with the recipients/)
  assert.doesNotMatch(markup, /Es ging keine Mail raus/)
  assert.deepEqual(buttons(markup), [])
})

test('die Abschlussmeldung nennt vom Mailserver abgelehnte Empfänger', () => {
  const markup = render({ kind: 'done', message: 'Versand abgeschlossen: 2 Mails.', rejected: ['b@x.de'] })
  assert.match(markup, /abgelehnt|rejected/i)
  assert.match(markup, /b@x\.de/)
  assert.match(markup, /role="alert"/)
})
