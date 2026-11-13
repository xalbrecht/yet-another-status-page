import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { escapeXml, svgDocument, truncate } from '@/lib/report/export/svg'
import { svgToPng } from '@/lib/report/export/render'

test('escapeXml maskiert die Zeichen, die ein SVG ungültig machen', () => {
  assert.equal(escapeXml('A & B <"x">'), 'A &amp; B &lt;&quot;x&quot;&gt;')
})

test('truncate kürzt mit Auslassungszeichen und lässt kurze Texte unverändert', () => {
  assert.equal(truncate('abcdefghij', 5), 'abcd…')
  assert.equal(truncate('abc', 5), 'abc')
  assert.equal(truncate('abcde', 5), 'abcde')
})

test('svgToPng liefert ein PNG mit 2000 px Breite und passender Höhe', async () => {
  const png = await svgToPng(svgDocument(1000, 400, '<rect width="1000" height="400" fill="#c8402f"/>'))
  assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47])
  const meta = await sharp(png).metadata()
  assert.equal(meta.width, 2000)
  assert.equal(meta.height, 800)
})

test('svgToPng rendert maskierten Text mit Sonderzeichen ohne Fehler', async () => {
  const body = `<text x="10" y="40" font-size="24">${escapeXml('Störung & <Test> "x"')}</text>`
  const png = await svgToPng(svgDocument(1000, 100, body))
  assert.ok(png.length > 100)
})

test('svgToPng hat einen weißen Hintergrund ohne Durchsichtigkeit', async () => {
  const png = await svgToPng(svgDocument(100, 100, ''), 100)
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true })
  assert.equal(info.channels, 3)
  assert.deepEqual([...data.subarray(0, 3)], [255, 255, 255])
})
