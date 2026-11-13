import sharp from 'sharp'

/** Breite der exportierten Bilder in Pixeln (Konzept 3). */
export const EXPORT_IMAGE_WIDTH = 2000

/**
 * Rendert ein SVG zu PNG auf weißem Grund. `sharp` ist im Projekt vorhanden, ein Browser ist im Image nicht nötig.
 * Die Schrift kommt aus dem Image (`fontconfig`, `font-dejavu`), ohne sie bleibt der Text leer.
 */
export async function svgToPng(svg: string, widthPx: number = EXPORT_IMAGE_WIDTH): Promise<Buffer> {
  return sharp(Buffer.from(svg), { density: 300 })
    .resize({ width: widthPx })
    .flatten({ background: '#ffffff' })
    .png()
    .toBuffer()
}
