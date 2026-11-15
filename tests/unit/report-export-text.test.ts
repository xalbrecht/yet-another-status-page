import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stripEmoji, textEl } from '@/lib/report/export/svg'
import { trendChart } from '@/lib/report/export/charts'
import { months } from './export-fixtures'

test('stripEmoji entfernt Emoji, Flaggen und Verbindungszeichen, lässt © ™ ▲ ▼ ✓ stehen', () => {
  assert.equal(stripEmoji('Mail 📧 Dienst'), 'Mail Dienst')
  assert.equal(stripEmoji('Flagge 🇩🇪'), 'Flagge')
  assert.equal(stripEmoji('Familie 👨‍👩‍👧'), 'Familie')
  assert.equal(stripEmoji('Tel ☎️ x'), 'Tel x')
  assert.equal(stripEmoji('Café © ™ ▲ ▼ ✓'), 'Café © ™ ▲ ▼ ✓')
})

test('textEl schreibt keine Emoji in das Bild', () => {
  assert.doesNotMatch(textEl(0, 0, 'Portal 🚀'), /🚀/)
})

test('trendChart: bei sehr niedrigen Werten höchstens acht Gitterlinien', () => {
  const trend = months.map((month, index) => ({ key: month.key, label: month.label, availability: index === 3 ? 12.5 : 98 }))
  const svg = trendChart(trend, 99.5, 'de-DE', 1000, 300)
  const grid = (svg.match(/<line /g) ?? []).length - 1 // ohne Zielwertlinie
  assert.ok(grid <= 8, `Gitterlinien: ${grid}`)
})

test('trendChart: bei Werten nahe 100 bleibt die feine Teilung', () => {
  const trend = months.map((month, index) => ({ key: month.key, label: month.label, availability: 99.9 - index * 0.01 }))
  const svg = trendChart(trend, 99.5, 'de-DE', 1000, 300)
  const labels = [...svg.matchAll(/>(\d+,\d{2})</g)].map((match) => match[1])
  assert.ok(labels.includes('99,75') || labels.includes('99,50'), labels.join(' '))
})
