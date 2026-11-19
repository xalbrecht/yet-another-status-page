import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { MaintenanceBar } from '@/components/status/MaintenanceBar'

test('Wartungsleiste: gefüllt, solange das Banner nicht selbst „Wartung“ zeigt', () => {
  const html = renderToStaticMarkup(<MaintenanceBar text="Wartungsarbeiten laufen: 1 Dienst ohne Einschränkung" />)
  assert.match(html, /data-testid="maintenance-bar"/)
  assert.match(html, /data-variant="solid"/)
  assert.match(html, /Wartungsarbeiten laufen: 1 Dienst ohne Einschränkung/)
})

test('Wartungsleiste: nur umrandet, wenn das Banner selbst blau ist (kein zweiter blauer Balken)', () => {
  const html = renderToStaticMarkup(<MaintenanceBar text="x" outlined />)
  assert.match(html, /data-variant="outline"/)
  assert.doesNotMatch(html, /bg-status-bar-maintenance/)
})

// Kontrast: WCAG AA verlangt für kleine Schrift mindestens 4,5 zu 1.
const css = readFileSync('src/app/(frontend)/globals.css', 'utf8')
const block = (selector: string) => css.slice(css.indexOf(selector + ' {'), css.indexOf('}', css.indexOf(selector + ' {')))
const token = (selector: string, name: string): [number, number, number] => {
  const match = new RegExp(`--${name}:\\s*(\\d+)\\s+(\\d+)%\\s+(\\d+)%`).exec(block(selector))
  assert.ok(match, `${name} fehlt in ${selector}`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}
function luminance([h, s, l]: [number, number, number]): number {
  const sat = s / 100
  const light = l / 100
  const a = sat * Math.min(light, 1 - light)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(f(0)) + 0.7152 * lin(f(8)) + 0.0722 * lin(f(4))
}
const contrast = (a: [number, number, number], b: [number, number, number]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
const white: [number, number, number] = [0, 0, 100]

for (const [name, selector] of [['hell', ':root'], ['dunkel', '.dark']] as const) {
  test(`Wartungsleiste ${name}: weiße Schrift auf der Fläche erreicht 4,5 zu 1`, () => {
    assert.ok(contrast(white, token(selector, 'status-bar-maintenance')) >= 4.5)
  })
  test(`Wartungsleiste ${name}, umrandet: Schrift erreicht 4,5 zu 1 auf der Kartenfläche`, () => {
    assert.ok(contrast(token(selector, 'status-bar-maintenance-text'), token(selector, 'card')) >= 4.5)
  })
}
