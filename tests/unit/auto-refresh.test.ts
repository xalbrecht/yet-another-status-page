import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_DATETIME_CONFIG } from '@/lib/datetime'
import {
  AUTO_REFRESH_MIN_DELAY_MS,
  autoRefreshProps,
  cacheMinutesSetting,
  isRefreshPaused,
  parseAutoRefreshMinutes,
  refreshDelayMs,
} from '@/lib/auto-refresh'

test('parseAutoRefreshMinutes: nur 1, 3, 5 und 10 schalten das Neuladen ein', () => {
  for (const minutes of [1, 3, 5, 10]) {
    assert.equal(parseAutoRefreshMinutes(String(minutes)), minutes)
    assert.equal(parseAutoRefreshMinutes(minutes), minutes)
  }
  for (const value of ['off', '', null, undefined, '2', '0', '-1', 'abc', 7, {}]) {
    assert.equal(parseAutoRefreshMinutes(value), null, String(value))
  }
})

test('cacheMinutesSetting: ist das Neuladen an, gilt sein Intervall als Dauer des Zwischenspeichers', () => {
  assert.equal(cacheMinutesSetting({ autoRefreshMinutes: '5', lagebildCacheMinutes: '1' }), '5')
  assert.equal(cacheMinutesSetting({ autoRefreshMinutes: '1', lagebildCacheMinutes: '10' }), '1')
  assert.equal(cacheMinutesSetting({ autoRefreshMinutes: 'off', lagebildCacheMinutes: '3' }), '3')
  assert.equal(cacheMinutesSetting({ autoRefreshMinutes: null, lagebildCacheMinutes: '10' }), '10')
  assert.equal(cacheMinutesSetting({}), undefined)
})

test('refreshDelayMs: lädt am Ende der Zwischenspeicher-Zeit neu, gerechnet vom Alter des Stands', () => {
  // Stand ist 0 s alt, Intervall 5 Minuten: Ende bei 300 s, dazu Spielraum
  assert.equal(refreshDelayMs({ ageMs: 0, minutes: 5, marginMs: 1_000 }), 301_000)
  // Stand ist schon 2 Minuten alt (Besucher kam spät): Rest 3 Minuten
  assert.equal(refreshDelayMs({ ageMs: 120_000, minutes: 5, marginMs: 1_000 }), 181_000)
  // Der Spielraum verteilt die Besucher, damit nicht alle gleichzeitig anfragen
  assert.equal(refreshDelayMs({ ageMs: 0, minutes: 1, marginMs: 3_500 }), 63_500)
})

test('refreshDelayMs: nie unter der Mindestwartezeit, auch bei abgelaufenem oder unsinnigem Alter', () => {
  assert.equal(refreshDelayMs({ ageMs: 600_000, minutes: 5, marginMs: 1_000 }), AUTO_REFRESH_MIN_DELAY_MS)
  assert.equal(refreshDelayMs({ ageMs: 300_000, minutes: 5, marginMs: 0 }), AUTO_REFRESH_MIN_DELAY_MS)
  // negatives Alter (Uhren der Prozesse weichen ab) zählt als 0
  assert.equal(refreshDelayMs({ ageMs: -60_000, minutes: 5, marginMs: 1_000 }), 301_000)
  assert.equal(refreshDelayMs({ ageMs: Number.NaN, minutes: 5, marginMs: 1_000 }), 301_000)
})

test('isRefreshPaused: Tab unsichtbar, Fenster offen oder Eingabefeld mit Fokus pausieren', () => {
  const idle = { hidden: false, dialogOpen: false, focusedTag: 'BODY', focusedEditable: false }
  assert.equal(isRefreshPaused(idle), false)
  assert.equal(isRefreshPaused({ ...idle, hidden: true }), true)
  assert.equal(isRefreshPaused({ ...idle, dialogOpen: true }), true)
  for (const focusedTag of ['INPUT', 'TEXTAREA', 'SELECT']) {
    assert.equal(isRefreshPaused({ ...idle, focusedTag }), true, focusedTag)
  }
  assert.equal(isRefreshPaused({ ...idle, focusedTag: 'DIV', focusedEditable: true }), true)
  // ein Knopf oder Link mit Fokus pausiert nicht
  assert.equal(isRefreshPaused({ ...idle, focusedTag: 'BUTTON' }), false)
  assert.equal(isRefreshPaused({ ...idle, focusedTag: 'A' }), false)
})

test('autoRefreshProps: Aus liefert nichts, sonst Minuten, Alter des Stands und seine Uhrzeit', () => {
  const dt = { ...DEFAULT_DATETIME_CONFIG, timezone: 'Europe/Berlin', locale: 'de-DE' }
  const standAt = Date.UTC(2026, 10, 27, 9, 42, 10)
  assert.equal(autoRefreshProps({ autoRefreshMinutes: 'off' }, dt, standAt, standAt), null)
  assert.equal(autoRefreshProps({}, dt, standAt, standAt), null)

  const props = autoRefreshProps({ autoRefreshMinutes: '5' }, dt, standAt, standAt + 90_000)
  assert.ok(props)
  assert.equal(props.minutes, 5)
  assert.equal(props.ageMs, 90_000)
  assert.match(props.standLabel, /^10:42/)
  assert.equal(props.showInterval, false, 'ohne Angabe nennt die Anzeige den Takt nicht')

  // Feld „Takt in der Anzeige nennen“: nur ein ausdrückliches Ja zeigt den Takt
  assert.equal(autoRefreshProps({ autoRefreshMinutes: '5', autoRefreshShowInterval: true }, dt, standAt, standAt)?.showInterval, true)
  for (const value of [false, null, undefined, 'true', 1]) {
    assert.equal(autoRefreshProps({ autoRefreshMinutes: '5', autoRefreshShowInterval: value }, dt, standAt, standAt)?.showInterval, false, String(value))
  }
  // bei ausgeschaltetem Neuladen gibt es auch mit dem Haken keine Anzeige
  assert.equal(autoRefreshProps({ autoRefreshMinutes: 'off', autoRefreshShowInterval: true }, dt, standAt, standAt), null)

  // ohne Stand (Seiten ohne Zwischenspeicher): Zeitpunkt des Aufrufs, Alter 0
  const served = Date.UTC(2026, 10, 27, 9, 50, 0)
  const noStand = autoRefreshProps({ autoRefreshMinutes: '1' }, dt, undefined, served)
  assert.equal(noStand?.ageMs, 0)
  assert.match(noStand?.standLabel ?? '', /^10:50/)

  // Stand nach dem Aufruf (Uhren weichen ab): Alter nie negativ
  assert.equal(autoRefreshProps({ autoRefreshMinutes: '3' }, dt, served + 5_000, served)?.ageMs, 0)
})
