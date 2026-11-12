import { FONT_FAMILY, TEXT_COLOR } from './palette'

/** Kleine Helfer zum Schreiben von SVG als Zeichenkette für die exportierten Bilder. */

/** Maskiert Text für den Einsatz in SVG. Ohne das wirft `sharp` bei `&` oder `<` im Dienstnamen. */
export function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

/** Kürzt einen Text auf höchstens `maxChars` Zeichen, das letzte Zeichen ist dann „…“. */
export function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, Math.max(1, maxChars - 1))}…` : text
}

/** Vollständiges SVG mit weißem Hintergrund, Schrift und Textfarbe. `body` ist bereits gültiges SVG. */
export function svgDocument(width: number, height: number, body: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" ` +
    `font-family="${FONT_FAMILY}" fill="${TEXT_COLOR}">` +
    `<rect width="${width}" height="${height}" fill="#ffffff"/>${body}</svg>`
  )
}
