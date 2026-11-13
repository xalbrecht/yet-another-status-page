import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupBlocks } from '@/lib/report/export/blocks-group'
import { svgToPng } from '@/lib/report/export/render'
import type { GroupSheetData } from '@/lib/report/group-sheet'
import { emptyDays, HOUR, makeReportData, months, rankingRow } from './export-fixtures'

const sheet = (override: Partial<GroupSheetData> = {}): GroupSheetData => ({
  month: { key: '2026-10', label: 'Oktober 2026' },
  perService: [{ serviceId: 1, name: 'MACH', majorMs: 1.5 * HOUR, partialMs: 2 * HOUR, degradedMs: 0 }],
  perDay: emptyDays(31, {
    12: [{ serviceId: 1, name: 'MACH', status: 'partial', ms: 2 * HOUR }],
    13: [{ serviceId: 1, name: 'MACH', status: 'major', ms: 1.5 * HOUR }],
  }),
  ...override,
})
const groupData = (override = {}) => makeReportData({ scope: { groupId: 1, groupName: 'Haushalt', serviceCount: 2 }, sheet: sheet(), ...override })
const svgOf = (blocks: ReturnType<typeof groupBlocks>, file: string) => blocks.find((block) => block.file === file)!.svg
const height = (svg: string) => Number(/<svg[^>]* height="(\d+)"/.exec(svg)![1])

test('mit Ausfällen entstehen sechs Dateien in der vorgesehenen Reihenfolge', () => {
  assert.deepEqual(groupBlocks(groupData(), 'de-DE').map((block) => block.file), [
    '00-gruppenblatt.png',
    '01-entwicklung-12-monate.png',
    '02-dienste-schwaechste-zuerst.png',
    '03-stoerungen-je-dienst.png',
    '04-stoerungen-je-tag.png',
    '05-waermekarte-dienste.png',
  ])
})

test('ohne Störungen im Monat fehlen Block 3 und 4', () => {
  const data = groupData({ sheet: sheet({ perService: [], perDay: emptyDays(31) }) })
  assert.deepEqual(groupBlocks(data, 'de-DE').map((block) => block.file), ['00-gruppenblatt.png', '01-entwicklung-12-monate.png', '02-dienste-schwaechste-zuerst.png', '05-waermekarte-dienste.png'])
})

test('mit nur einer Einschränkung entsteht Block 3, aber nicht Block 4', () => {
  const data = groupData({ sheet: sheet({ perService: [{ serviceId: 1, name: 'Langsam', majorMs: 0, partialMs: 0, degradedMs: 2 * HOUR }], perDay: emptyDays(31) }) })
  const files = groupBlocks(data, 'de-DE').map((block) => block.file)
  assert.ok(files.includes('03-stoerungen-je-dienst.png'))
  assert.ok(!files.includes('04-stoerungen-je-tag.png'))
})

test('ohne sheet fehlen beide Blöcke, der Rest entsteht', () => {
  const files = groupBlocks(groupData({ sheet: null }), 'de-DE').map((block) => block.file)
  assert.deepEqual(files, ['00-gruppenblatt.png', '01-entwicklung-12-monate.png', '02-dienste-schwaechste-zuerst.png', '05-waermekarte-dienste.png'])
})

test('alle Bilder sind gültiges SVG und rendern zu PNG', async () => {
  for (const block of groupBlocks(groupData(), 'de-DE', 'Oktober 2026')) {
    assert.ok((await svgToPng(block.svg)).length > 200, block.file)
  }
})

test('das Gruppenblatt ist höher als jeder Einzelblock und nennt Gruppe und Monat', () => {
  const blocks = groupBlocks(groupData(), 'de-DE', 'Oktober 2026')
  const sheetSvg = svgOf(blocks, '00-gruppenblatt.png')
  assert.match(sheetSvg, /Haushalt/)
  assert.match(sheetSvg, /Oktober 2026/)
  for (const block of blocks.slice(1)) assert.ok(height(sheetSvg) > height(block.svg), block.file)
})

test('Block 4 als Einzelbild zeigt nur Tage mit Ausfall, im Gruppenblatt stehen alle Tage auf der Achse', () => {
  const blocks = groupBlocks(groupData(), 'de-DE')
  const single = svgOf(blocks, '04-stoerungen-je-tag.png')
  assert.equal((single.match(/data-bar="1"/g) ?? []).length, 2)
  assert.match(single, />12</)
  assert.match(single, />13</)
  assert.doesNotMatch(single, />20</)
  assert.match(svgOf(blocks, '00-gruppenblatt.png'), />20</)
})

test('ab drei Balken an einem Tag steht die Zahl der Dienste statt der Namen', () => {
  const bar = (id: number, name: string, status: 'partial' | 'major', ms: number) => ({ serviceId: id, name, status, ms })
  const perDay = emptyDays(31, { 20: [bar(1, 'Alpha', 'major', 3 * HOUR), bar(2, 'Beta', 'major', 2 * HOUR), bar(3, 'Gamma', 'partial', HOUR)] })
  const single = svgOf(groupBlocks(groupData({ sheet: sheet({ perDay }) }), 'de-DE'), '04-stoerungen-je-tag.png')
  assert.equal((single.match(/data-bar="1"/g) ?? []).length, 3)
  assert.doesNotMatch(single, />Alpha</)
  assert.match(single, />3 (Dienste|services)</)
})

test('Dienstnamen sind maskiert und in Block 4 auf 16 Zeichen gekürzt', () => {
  const name = 'X'.repeat(120)
  const ranking = [rankingRow(1, 'Haus & Hof <1>', 97, 3 * HOUR), rankingRow(2, name, 98, HOUR)]
  const perDay = emptyDays(31, { 5: [{ serviceId: 1, name: 'Haus & Hof <1>', status: 'major', ms: HOUR }, { serviceId: 2, name, status: 'partial', ms: HOUR / 2 }] })
  const blocks = groupBlocks(groupData({ ranking, sheet: sheet({ perDay, perService: [{ serviceId: 1, name: 'Haus & Hof <1>', majorMs: HOUR, partialMs: 0, degradedMs: 0 }] }) }), 'de-DE')
  assert.match(svgOf(blocks, '04-stoerungen-je-tag.png'), />Haus &amp; Hof &lt;1&gt;</)
  assert.match(svgOf(blocks, '04-stoerungen-je-tag.png'), /X{15}…/)
  assert.doesNotMatch(svgOf(blocks, '04-stoerungen-je-tag.png'), /X{16}/)
  assert.match(svgOf(blocks, '02-dienste-schwaechste-zuerst.png'), /Haus &amp; Hof &lt;1&gt;/)
})

test('eine Gruppe mit einem Dienst hat in Block 2 genau eine Zeile', () => {
  const data = groupData({ scope: { groupId: 1, groupName: 'Umwelt', serviceCount: 1 }, ranking: [rankingRow(1, 'Umweltportal', 100, 0)], sheet: sheet({ perService: [], perDay: emptyDays(31) }) })
  const svg = svgOf(groupBlocks(data, 'de-DE'), '02-dienste-schwaechste-zuerst.png')
  assert.equal((svg.match(/Umweltportal/g) ?? []).length, 1)
})

test('die Wärmekarte der Dienste teilt sich bei mehr als 12 Diensten in Bilder', () => {
  const rows = [{ name: 'Gesamt', values: months.map(() => 99.5), total: true }, ...Array.from({ length: 30 }, (_, i) => ({ name: `Dienst ${i + 1}`, values: months.map(() => 99.9) }))]
  const files = groupBlocks(groupData({ heat: { columns: months, rows } }), 'de-DE').map((block) => block.file).filter((file) => file.startsWith('05-'))
  assert.deepEqual(files, ['05-waermekarte-dienste.png', '05-waermekarte-dienste-2.png', '05-waermekarte-dienste-3.png'])
})
