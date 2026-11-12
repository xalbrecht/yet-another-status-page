/**
 * Farben und Schrift der exportierten Bilder (Konzept 3 und 6). Blau über Gelb zu Rot, kein Grün (Rot-Grün-Sehschwäche).
 * Die Stufen der Wärmekarte entsprechen `report.scss`, damit Bild und Bildschirm gleich aussehen.
 */
export const FONT_FAMILY = 'DejaVu Sans, sans-serif'

export const SEVERITY_COLOR = {
  major: '#c8402f',
  partial: '#e8903a',
  degraded: '#999999',
} as const

/** Stufen 0 bis 4 wie `heatClass`: 100 %, ab 99,9 %, ab 99,5 %, ab Ziel, unter Ziel. */
export const HEAT_COLOR = ['#eef1f5', '#d6e4f5', '#f7dfa8', '#f1b48a', '#e0796b'] as const

export const TEXT_COLOR = '#16202c'
export const MUTED_COLOR = '#5b6672'
export const LINE_COLOR = '#1f5fae'
export const GRID_COLOR = '#d9dee4'
export const TARGET_COLOR = '#b3261e'

/** Balkenfarben je Stufe der Wärmekarte: kräftiger als `HEAT_COLOR`, damit auch 100 % als Balken sichtbar ist. */
export const BAR_COLOR = ['#1f5fae', '#6f9fd8', '#e6c455', '#e8903a', '#c8402f'] as const
export const TRACK_COLOR = '#eef1f5'
