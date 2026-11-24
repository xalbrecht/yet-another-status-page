import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { TrendChart } from '@/components/admin/availability-report/TrendChart'

const months = Array.from({ length: 12 }, (_, index) => ({ key: `2026-${String(index + 1).padStart(2, '0')}`, label: `M${index + 1}` }))

/** Verlauf mit Werten nur im letzten Monat, alle anderen Monate leer (frische Umgebung ohne Statusprotokoll). */
const trendWith = (last: number | null) => months.map((month, index) => ({ ...month, availability: index === months.length - 1 ? last : null }))

const gridLines = (html: string) => (html.match(/availability-report__grid/g) ?? []).length

for (const last of [100, 99.5, 90, 50, 0]) {
  test(`Verlauf mit nur einem Wert (${last} %) hat höchstens 8 Gitterlinien`, () => {
    const html = renderToStaticMarkup(<TrendChart trend={trendWith(last)} target={99} locale="de-DE" />)
    assert.ok(gridLines(html) >= 2, 'mindestens obere und untere Gitterlinie')
    assert.ok(gridLines(html) <= 8, `${gridLines(html)} Gitterlinien`)
  })
}

test('Verlauf ganz ohne Werte zeichnet nur Gitter um den Zielwert', () => {
  const html = renderToStaticMarkup(<TrendChart trend={trendWith(null)} target={99} locale="de-DE" />)
  assert.ok(gridLines(html) >= 2 && gridLines(html) <= 8)
  assert.ok(!html.includes('NaN'))
})
