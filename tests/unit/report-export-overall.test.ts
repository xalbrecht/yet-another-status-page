import { test } from 'node:test'
import assert from 'node:assert/strict'
import { overallBlocks } from '@/lib/report/export/blocks-overall'
import { svgToPng } from '@/lib/report/export/render'
import { HOUR, makeReportData, months, rankingRow } from './export-fixtures'

const manyGroups = (count: number) => [
  { name: 'Gesamt', values: months.map(() => 99.4), total: true },
  ...Array.from({ length: count }, (_, index) => ({ name: `Gruppe ${index + 1}`, values: months.map(() => 99.5) })),
]

test('overallBlocks liefert die fünf Bilder mit den vorgesehenen Dateinamen', () => {
  assert.deepEqual(
    overallBlocks(makeReportData(), 'de-DE').map((block) => block.file),
    ['01-kennzahlen.png', '02-entwicklung-12-monate.png', '03-schwaechste-dienste.png', '04-waermekarte-gruppen-1.png', '05-dienste-schwaechste-zuerst.png'],
  )
})

test('die Wärmekarte teilt 30 Gruppen in drei Bilder, 12 Gruppen bleiben in einem', () => {
  const heat = (count: number) => ({ columns: months, rows: manyGroups(count) })
  const files = (count: number) => overallBlocks(makeReportData({ heat: heat(count) }), 'de-DE').map((block) => block.file).filter((file) => file.startsWith('04-'))
  assert.deepEqual(files(30), ['04-waermekarte-gruppen-1.png', '04-waermekarte-gruppen-2.png', '04-waermekarte-gruppen-3.png'])
  assert.deepEqual(files(12), ['04-waermekarte-gruppen-1.png'])
})

test('jedes Bild ist ein gültiges SVG, das sich zu PNG rendern lässt', async () => {
  for (const block of overallBlocks(makeReportData(), 'de-DE', 'Oktober 2026')) {
    const png = await svgToPng(block.svg)
    assert.ok(png.length > 200, block.file)
  }
})

test('die Kennzahlen nennen Verfügbarkeit und Monate mit erreichtem Ziel', () => {
  const kpi = overallBlocks(makeReportData(), 'de-DE')[0].svg
  assert.match(kpi, /99,41 %/)
  assert.match(kpi, />1 (von|of) 1</)
})

test('Dienstnamen mit Sonderzeichen sind maskiert und lange Namen gekürzt', () => {
  const longName = 'X'.repeat(120)
  const ranking = [rankingRow(1, 'Haus & Hof <1>', 97, 4 * HOUR), rankingRow(2, longName, 98, HOUR)]
  const blocks = overallBlocks(makeReportData({ ranking, weakest: ranking }), 'de-DE')
  for (const file of ['03-schwaechste-dienste.png', '05-dienste-schwaechste-zuerst.png']) {
    const svg = blocks.find((block) => block.file === file)!.svg
    assert.match(svg, /Haus &amp; Hof &lt;1&gt;/, file)
    assert.doesNotMatch(svg, new RegExp(longName), file)
    assert.match(svg, /…/, file)
  }
})

test('ohne Dienste entstehen alle fünf Bilder trotzdem', async () => {
  const data = makeReportData({
    ranking: [],
    weakest: [],
    scope: { groupId: null, groupName: null, serviceCount: 0 },
    heat: { columns: months, rows: [{ name: 'Gesamt', values: months.map(() => null), total: true }] },
    kpis: { ...makeReportData().kpis, availability: null, longestOutage: null, serviceCount: 0, affectedServices: 0, outageCount: 0, downMs: 0 },
    trend: months.map((month) => ({ ...month, availability: null })),
  })
  const blocks = overallBlocks(data, 'de-DE')
  assert.equal(blocks.length, 5)
  for (const block of blocks) assert.ok((await svgToPng(block.svg)).length > 200, block.file)
})

test('ohne Ausfall steht im Bild der schwächsten Dienste ein Hinweis', () => {
  const svg = overallBlocks(makeReportData({ weakest: [] }), 'de-DE')[2].svg
  assert.match(svg, /Kein Ausfall in diesem Zeitraum|No outage in this period/)
})
