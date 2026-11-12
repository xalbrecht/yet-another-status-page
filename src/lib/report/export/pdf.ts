import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

/**
 * PDF des Berichts (Konzept 3): A4 hoch, Kopfzeile mit Titel, Fußzeile mit Seitenzahl. Bilder werden auf die Satzbreite
 * skaliert und nie durch einen Seitenumbruch geteilt. Standardschrift Helvetica (Umlaute ja, Emoji und Pfeile nein,
 * solche Zeichen werden durch „?“ ersetzt, sonst scheitert das Zeichnen).
 */
export type PdfBuilder = {
  addHeading(text: string): void
  addImage(png: Uint8Array): Promise<void>
  addText(lines: string[]): void
  finish(): Promise<Uint8Array>
}

const PAGE: [number, number] = [595.28, 841.89]
const MARGIN = 40
const HEADER = 22
const FOOTER = 26
const MUTED = rgb(0.36, 0.4, 0.45)

function makeSafe(font: PDFFont): (text: string) => string {
  const cache = new Map<string, string>()
  const convert = (char: string): string => {
    const cached = cache.get(char)
    if (cached !== undefined) return cached
    let result = '?'
    try {
      font.encodeText(char)
      result = char
    } catch {
      result = '?'
    }
    cache.set(char, result)
    return result
  }
  return (text) => Array.from(text.replace(/\s+/g, ' ')).map(convert).join('')
}

/** Bricht Text auf `maxWidth` um, zu lange Wörter werden zeichenweise getrennt. */
function wrap(font: PDFFont, size: number, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  const widthOf = (value: string) => font.widthOfTextAtSize(value, size)
  for (const word of text.split(' ')) {
    const candidate = line ? `${line} ${word}` : word
    if (widthOf(candidate) <= maxWidth) {
      line = candidate
      continue
    }
    if (line) lines.push(line)
    line = ''
    let rest = word
    while (widthOf(rest) > maxWidth && rest.length > 1) {
      let cut = rest.length - 1
      while (cut > 1 && widthOf(rest.slice(0, cut)) > maxWidth) cut--
      lines.push(rest.slice(0, cut))
      rest = rest.slice(cut)
    }
    line = rest
  }
  if (line) lines.push(line)
  return lines
}

export async function createPdfBuilder(title: string): Promise<PdfBuilder> {
  const doc = await PDFDocument.create()
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const safe = makeSafe(regular)
  const contentTop = PAGE[1] - MARGIN - HEADER
  const contentBottom = MARGIN + FOOTER
  const contentWidth = PAGE[0] - 2 * MARGIN
  let page: PDFPage | null = null
  let y = 0

  const newPage = () => {
    page = doc.addPage(PAGE)
    page.drawText(safe(title), { x: MARGIN, y: PAGE[1] - MARGIN, size: 9, font: regular, color: MUTED })
    y = contentTop
  }
  const ensure = (height: number) => {
    if (!page || y - height < contentBottom) newPage()
  }

  return {
    addHeading(text) {
      ensure(150)
      page!.drawText(safe(text), { x: MARGIN, y: y - 14, size: 14, font: bold })
      y -= 26
    },
    async addImage(png) {
      const image = await doc.embedPng(png)
      const scale = Math.min(contentWidth / image.width, (contentTop - contentBottom) / image.height)
      const width = image.width * scale
      const height = image.height * scale
      ensure(height)
      page!.drawImage(image, { x: MARGIN, y: y - height, width, height })
      y -= height + 12
    },
    addText(lines) {
      for (const text of lines) {
        for (const line of wrap(regular, 9, safe(text), contentWidth)) {
          ensure(13)
          page!.drawText(line, { x: MARGIN, y: y - 9, size: 9, font: regular })
          y -= 13
        }
        y -= 4
      }
    },
    async finish() {
      const pages = doc.getPages()
      pages.forEach((current, index) => {
        const label = `${index + 1} / ${pages.length}`
        current.drawText(label, { x: PAGE[0] - MARGIN - regular.widthOfTextAtSize(label, 8), y: MARGIN - 8, size: 8, font: regular, color: MUTED })
      })
      return doc.save()
    },
  }
}
