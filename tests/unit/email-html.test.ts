import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildMailMessage, buildSubscriptionRequestMail, generateEmailHtml } from '@/lib/email'
import type { EmailSetting } from '@/payload-types'

const hostile = '<script>alert(1)</script> & "x"'

const base = {
  siteName: hostile,
  title: hostile,
  body: `Zeile 1\n${hostile}\nZeile 3`,
  ctaText: hostile,
  ctaUrl: 'https://status.example/i/a?x=1&y="2"',
  unsubscribeUrl: 'https://status.example/u?a=1&b="2"',
  siteUrl: 'https://status.example/?a=1&b="2"',
  logoUrl: '/media/logo.png?a=1&b="2"',
  language: 'en',
}

test('Titel, Seitenname, Text und Linktext der Mail sind maskiert', () => {
  const html = generateEmailHtml(base)
  assert.ok(!html.includes('<script>'), 'ein <script> aus den Werten darf nicht im HTML stehen')
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;'))
  // Titel (<title> und Überschrift), Seitenname (alt-Attribut des Logos und Fußzeile), Text, Linktext
  assert.equal(html.split('&lt;script&gt;').length - 1, 6)
  // ohne Logo steht der Seitenname als Text im Kopf
  assert.equal(generateEmailHtml({ ...base, logoUrl: undefined }).split('&lt;script&gt;').length - 1, 6)
})

test('Adressen in Attributen sind maskiert und lassen kein Attribut zu', () => {
  const html = generateEmailHtml(base)
  assert.ok(html.includes('href="https://status.example/i/a?x=1&amp;y=&quot;2&quot;"'))
  assert.ok(html.includes('href="https://status.example/u?a=1&amp;b=&quot;2&quot;"'))
  assert.ok(html.includes('href="https://status.example/?a=1&amp;b=&quot;2&quot;"'))
  assert.ok(html.includes('src="https://status.example/?a=1&amp;b=&quot;2&quot;/media/logo.png?a=1&amp;b=&quot;2&quot;"'))
  assert.ok(!/(href|src|alt)="[^"]*"[^>]*"2"/.test(html), 'ein unmaskiertes Anführungszeichen beendet kein Attribut')
})

test('Zeilenumbrüche im Text werden <br>, die Zeichen daneben bleiben maskiert', () => {
  const html = generateEmailHtml({ ...base, body: 'a < b\n\nc & d' })
  assert.ok(html.includes('<div class="body">a &lt; b<br><br>c &amp; d</div>'))
})

test('ein Linktext ohne Adresse erzeugt keine Schaltfläche', () => {
  const html = generateEmailHtml({ ...base, ctaUrl: undefined })
  assert.ok(!html.includes('class="cta"'))
})

test('die Antrags-Mail maskiert die Adresse des Abonnenten einmal, nicht doppelt', () => {
  const { html, subject } = buildSubscriptionRequestMail({
    subscriberEmail: 'a&b<x>@example.org',
    subscriberId: 7,
    siteName: 'Status & Co',
    siteUrl: 'https://status.example',
    language: 'en',
  })
  assert.ok(html.includes('a&amp;b&lt;x&gt;@example.org'))
  assert.ok(!html.includes('&amp;amp;'), 'doppelt maskiert')
  assert.ok(html.includes('Status &amp; Co'))
  assert.ok(html.includes('href="https://status.example/admin/collections/subscribers/7"'))
  assert.ok(subject.includes('status.example'))
})

test('der Textteil der Mail zeigt die Zeichen, nicht ihre Maskierung', () => {
  const html = generateEmailHtml({ ...base, siteName: 'A & B', title: 'x < y', body: 'sagt "hallo"' })
  const message = buildMailMessage({ smtpFromAddress: 'a@example.org' } as EmailSetting, { to: 'b@example.org', subject: 's', html })
  const text = String(message.text)
  assert.ok(text.includes('A & B'))
  assert.ok(text.includes('x < y'))
  assert.ok(text.includes('sagt "hallo"'))
  assert.ok(!/&(amp|lt|gt|quot);/.test(text))
})

test('preferencesUrl erzeugt den Link „Auswahl ändern“, ohne die Option fehlt er', () => {
  const html = generateEmailHtml({ ...base, preferencesUrl: 'https://status.example/subscription/abc?a=1&b="2"' })
  assert.ok(html.includes('href="https://status.example/subscription/abc?a=1&amp;b=&quot;2&quot;"'))
  assert.ok(html.includes('>Change service group selection</a>'))
  // Abmeldelink bleibt unverändert
  assert.ok(html.includes('href="https://status.example/u?a=1&amp;b=&quot;2&quot;"'))

  const without = generateEmailHtml(base)
  assert.ok(!without.includes('/subscription/'))
  assert.ok(!without.includes('Change service group selection'))
  assert.ok(without.includes('href="https://status.example/u?a=1&amp;b=&quot;2&quot;"'))
})

test('der Link „Auswahl ändern“ erscheint auf Deutsch in der Mail', () => {
  const html = generateEmailHtml({ ...base, preferencesUrl: 'https://status.example/subscription/abc', language: 'de' })
  assert.ok(html.includes('>Auswahl der Dienstgruppen ändern</a>'))
})

test('der Text-Teil ohne eigenen Text enthält kein CSS, aber den lesbaren Inhalt', () => {
  const html = generateEmailHtml({ ...base, siteName: 'Statusseite', title: 'Titel der Mail', body: 'a < b\n\nc & d', language: 'de' })
  assert.ok(html.includes('<style>'), 'Voraussetzung: die HTML-Fassung trägt ein <style>')
  const message = buildMailMessage({ smtpFromAddress: 'a@example.org' } as EmailSetting, { to: 'b@example.org', subject: 's', html })
  const text = String(message.text)
  assert.ok(!text.includes('{'), 'keine CSS-Regel im Text-Teil')
  assert.ok(!/font-family|<style|<title/i.test(text), 'kein Rest aus <head> im Text-Teil')
  assert.ok(text.includes('Titel der Mail'))
  assert.ok(text.includes('a < b'))
  assert.ok(text.includes('c & d'))
})
