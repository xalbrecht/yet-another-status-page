import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Kontrast der Schrift auf dem Statusbanner (Issue #243). Der Test liest die Tokens `--status-banner-*` aus
 * `globals.css` und rechnet das Kontrastverhältnis nach WCAG aus. Schrift 16 px, mittelfett: mindestens 4,5 : 1 (AA).
 * Die Schrift ist weiß, außer ein Token `--status-banner-<zustand>-foreground` gibt eine andere Farbe vor.
 */
const css = readFileSync(join(process.cwd(), 'src/app/(frontend)/globals.css'), 'utf8')
const STATES = ['operational', 'degraded', 'partial', 'major', 'maintenance'] as const
const MIN_RATIO = 4.5

type Hsl = [number, number, number]

/** Inhalt des ersten Blocks mit dem Selektor (ohne verschachtelte Blöcke, `globals.css` hat dort keine). */
function block(selector: string): string {
  const start = css.indexOf(`\n${selector} {`)
  assert.ok(start >= 0, `Block ${selector} fehlt in globals.css`)
  return css.slice(start, css.indexOf('\n}', start))
}

function token(blockText: string, name: string): Hsl | undefined {
  const match = blockText.match(new RegExp(`--${name}:\\s*(\\d+(?:\\.\\d+)?)\\s+(\\d+(?:\\.\\d+)?)%\\s+(\\d+(?:\\.\\d+)?)%`))
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined
}

function rgb([h, s, l]: Hsl): [number, number, number] {
  const sat = s / 100
  const light = l / 100
  const a = sat * Math.min(light, 1 - light)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [f(0), f(8), f(4)]
}

function luminance(color: Hsl): number {
  const [r, g, b] = rgb(color).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: Hsl, b: Hsl): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const WHITE: Hsl = [0, 0, 100]
const themes = { hell: block(':root'), dunkel: block('.dark') }

for (const [theme, text] of Object.entries(themes)) {
  for (const state of STATES) {
    test(`Banner ${state} im Theme ${theme}: Schrift erreicht ${MIN_RATIO} : 1`, () => {
      const background = token(text, `status-banner-${state}`)
      assert.ok(background, `Token --status-banner-${state} fehlt im Theme ${theme}`)
      const foreground = token(text, `status-banner-${state}-foreground`) ?? WHITE
      const ratio = contrastRatio(background, foreground)
      assert.ok(ratio >= MIN_RATIO, `${state} (${theme}): ${ratio.toFixed(2)} : 1, verlangt ${MIN_RATIO} : 1`)
    })
  }
}

test('Zustände ohne Vorgabe der Schriftfarbe: StatusBanner setzt weiße Schrift, mit Vorgabe die Farbe des Tokens', () => {
  const component = readFileSync(join(process.cwd(), 'src/components/status/StatusBanner.tsx'), 'utf8')
  for (const state of STATES) {
    const hasToken = themes.hell.includes(`--status-banner-${state}-foreground`) || themes.dunkel.includes(`--status-banner-${state}-foreground`)
    if (hasToken) {
      assert.ok(component.includes(`text-status-banner-${state}-foreground`), `StatusBanner nutzt das Token für ${state} nicht`)
    }
  }
})
