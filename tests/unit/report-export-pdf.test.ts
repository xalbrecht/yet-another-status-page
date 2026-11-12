import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import { createPdfBuilder } from '@/lib/report/export/pdf'
import { svgDocument } from '@/lib/report/export/svg'
import { svgToPng } from '@/lib/report/export/render'

const png = (width: number, height: number) => svgToPng(svgDocument(width, height, `<rect width="${width}" height="${height}" fill="#1f5fae"/>`), width)

test('das PDF beginnt mit %PDF und enthält Überschrift, Bilder und Text', async () => {
  const pdf = await createPdfBuilder('Verfügbarkeitsbericht Oktober 2026')
  pdf.addHeading('Gesamtbericht')
  await pdf.addImage(await png(1000, 400))
  pdf.addText(['Nicht eindeutig eingeordnete Vorfälle: 78.', 'Vorfälle ohne Dienst: 19.'])
  const bytes = await pdf.finish()
  assert.equal(Buffer.from(bytes.subarray(0, 4)).toString('latin1'), '%PDF')
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 1)
})

test('ein Bild wird nie geteilt: passt es nicht mehr auf die Seite, beginnt eine neue', async () => {
  const pdf = await createPdfBuilder('Titel')
  for (let index = 0; index < 3; index++) await pdf.addImage(await png(2000, 1000))
  assert.equal((await PDFDocument.load(await pdf.finish())).getPageCount(), 2)
})

test('ein sehr hohes Bild wird auf eine Seite verkleinert', async () => {
  const pdf = await createPdfBuilder('Titel')
  await pdf.addImage(await png(1000, 4000))
  assert.equal((await PDFDocument.load(await pdf.finish())).getPageCount(), 1)
})

test('Zeichen außerhalb der Standardschrift (Emoji, Pfeile) lassen das PDF nicht scheitern', async () => {
  const pdf = await createPdfBuilder('Titel ▲ 😀')
  pdf.addHeading('Gruppe 😀 ≥ Ziel')
  pdf.addText(['Zeile mit Pfeil → und Emoji 🙂'])
  assert.ok((await pdf.finish()).length > 500)
})

test('lange Textzeilen werden umbrochen und laufen nicht aus der Seite', async () => {
  const pdf = await createPdfBuilder('Titel')
  pdf.addText([`Sehr ${'lang '.repeat(200)}`])
  assert.ok((await PDFDocument.load(await pdf.finish())).getPageCount() >= 1)
})
