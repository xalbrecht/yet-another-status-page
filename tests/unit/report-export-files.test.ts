import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { ReportData } from '@/lib/report/aggregate'
import { exportFiles, pdfBlockFiles, slugify, uniqueSlugs, type ExportFile } from '@/lib/report/export/files'
import type { ReportContext } from '@/lib/report/load'
import { parseReportParams } from '@/lib/report/params'
import { emptyDays, HOUR, makeReportData, rankingRow } from './export-fixtures'

const entry = (id: number, name: string) => ({ id, name, serviceCount: 2, availability: 99.5, target: 99, level: 2 as const })
const period = { key: '2026-10', label: 'Oktober 2026', start: 0, end: 1, partial: false }

function context(groups: Array<{ id: number; name: string }>, events: string[] = []): ReportContext {
  const params = parseReportParams({})
  const overall = makeReportData({ groupList: groups.map((group) => entry(group.id, group.name)) })
  return {
    period,
    params,
    locale: 'de-DE',
    timeZone: 'Europe/Berlin',
    groups,
    build: (group) => {
      events.push(`build:${group ?? 'alle'}`)
      if (!group) return { data: overall, params }
      const name = groups.find((item) => String(item.id) === group)?.name ?? ''
      const data: ReportData = makeReportData({
        scope: { groupId: Number(group), groupName: name, serviceCount: 2 },
        ranking: [rankingRow(1, `${name} Dienst`, 98, 2 * HOUR)],
        sheet: { month: { key: '2026-10', label: 'Oktober 2026' }, perService: [], perDay: emptyDays(31) },
      })
      return { data, params: { ...params, group } }
    },
  }
}

async function collect(iterator: AsyncGenerator<ExportFile>, events?: string[]): Promise<ExportFile[]> {
  const files: ExportFile[] = []
  for await (const file of iterator) {
    events?.push(`file:${file.path}`)
    files.push(file)
  }
  return files
}

test('slugify macht ASCII-Namen aus Gruppennamen', () => {
  assert.equal(slugify('Bauen'), 'bauen')
  assert.equal(slugify('Buß- und Verwarngeld'), 'buss-und-verwarngeld')
  assert.equal(slugify('A/B Straße'), 'a-b-strasse')
  assert.equal(slugify('Schul-IT'), 'schul-it')
  assert.equal(slugify('***'), 'gruppe')
  assert.equal(slugify('Ärger Öl Übung'), 'aerger-oel-uebung')
})

test('uniqueSlugs hängt bei gleichen Namen die Id an, sonst nicht', () => {
  const same = uniqueSlugs([{ id: 1, name: 'Bauen' }, { id: 2, name: 'Bauen' }, { id: 3, name: 'Netzwerk' }])
  assert.equal(same.get(1), 'bauen-1')
  assert.equal(same.get(2), 'bauen-2')
  assert.equal(same.get(3), 'netzwerk')
  assert.equal(uniqueSlugs([{ id: 1, name: 'Bauen' }]).get(1), 'bauen')
})

test('exportFiles liefert Gesamtbericht, je Gruppe ein Blatt, Excel und PDF mit sauberen Pfaden', async () => {
  const files = await collect(exportFiles(context([{ id: 1, name: 'Bauen' }, { id: 2, name: 'Haushalt und Finanzen' }])))
  const paths = files.map((file) => file.path)
  assert.ok(paths.every((path) => path.startsWith('verfuegbarkeitsbericht-2026-10/')))
  assert.ok(paths.includes('verfuegbarkeitsbericht-2026-10/gesamt/01-kennzahlen.png'))
  assert.ok(paths.includes('verfuegbarkeitsbericht-2026-10/gruppen/bauen/00-gruppenblatt.png'))
  assert.ok(paths.includes('verfuegbarkeitsbericht-2026-10/gruppen/haushalt-und-finanzen/00-gruppenblatt.png'))
  assert.equal(paths.filter((path) => path.endsWith('.xlsx')).length, 1)
  assert.equal(paths.filter((path) => path.endsWith('.pdf')).length, 1)
  assert.ok(paths.every((path) => /^[a-z0-9\-./]+$/.test(path) && !path.includes('..')), paths.join('\n'))
})

test('Dateien haben den richtigen Anfang: PNG, PDF, Excel', async () => {
  const files = await collect(exportFiles(context([{ id: 1, name: 'Bauen' }])))
  const head = (file: ExportFile, length: number) => Buffer.from(file.data.subarray(0, length)).toString('latin1')
  for (const file of files) {
    if (file.path.endsWith('.png')) assert.deepEqual([...file.data.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], file.path)
    if (file.path.endsWith('.pdf')) assert.equal(head(file, 4), '%PDF')
    if (file.path.endsWith('.xlsx')) assert.equal(head(file, 2), 'PK')
  }
})

test('mit groupId kommen nur die Dateien dieser Gruppe, ohne Excel, PDF und Gesamtbericht', async () => {
  const files = await collect(exportFiles(context([{ id: 1, name: 'Bauen' }, { id: 2, name: 'Netzwerk' }]), { groupId: 2 }))
  assert.ok(files.length >= 4)
  assert.ok(files.every((file) => file.path.startsWith('verfuegbarkeitsbericht-2026-10/gruppen/netzwerk/')), files.map((file) => file.path).join('\n'))
})

test('ein Bericht ohne Gruppen und Dienste liefert Gesamtbild, Excel und PDF ohne Fehler', async () => {
  const files = await collect(exportFiles(context([])))
  const paths = files.map((file) => file.path)
  assert.ok(paths.some((path) => path.includes('/gesamt/01-kennzahlen.png')))
  assert.ok(paths.some((path) => path.endsWith('.xlsx')))
  assert.ok(paths.some((path) => path.endsWith('.pdf')))
  assert.ok(!paths.some((path) => path.includes('/gruppen/')))
})

test('gleiche Gruppennamen ergeben verschiedene Ordner', async () => {
  const files = await collect(exportFiles(context([{ id: 1, name: 'Bauen' }, { id: 2, name: 'Bauen' }])))
  const folders = new Set(files.map((file) => /\/gruppen\/([^/]+)\//.exec(file.path)?.[1]).filter(Boolean))
  assert.deepEqual([...folders].sort(), ['bauen-1', 'bauen-2'])
})

test('die Gruppen werden nacheinander gebaut: build für die nächste Gruppe erst nach den Dateien der vorigen', async () => {
  const events: string[] = []
  await collect(exportFiles(context([{ id: 1, name: 'Eins' }, { id: 2, name: 'Zwei' }], events), {}), events)
  const secondBuild = events.indexOf('build:2')
  const lastOfFirst = events.map((event, index) => (event.includes('/gruppen/eins/') ? index : -1)).reduce((max, index) => Math.max(max, index), -1)
  assert.ok(secondBuild > lastOfFirst, events.join('\n'))
})

test('eine unbekannte Gruppe wirft einen Fehler', async () => {
  await assert.rejects(() => collect(exportFiles(context([{ id: 1, name: 'Bauen' }]), { groupId: 99 })), /99/)
})

test('uniqueSlugs bleibt eindeutig, auch wenn ein angehängter Name schon vergeben ist', () => {
  const slugs = uniqueSlugs([{ id: 1, name: 'Bauen' }, { id: 2, name: 'Bauen' }, { id: 3, name: 'Bauen 1' }, { id: 4, name: '***' }, { id: 5, name: 'Gruppe 4' }])
  assert.equal(new Set(slugs.values()).size, 5, [...slugs.values()].join(','))
})

test('pdfOnly liefert nur die PDF-Datei', async () => {
  const files = await collect(exportFiles(context([{ id: 1, name: 'Bauen' }]), { pdfOnly: true }))
  assert.deepEqual(files.map((file) => file.path), ['verfuegbarkeitsbericht-2026-10/verfuegbarkeitsbericht-2026-10.pdf'])
})

test('pdfBlockFiles nimmt ein kurzes Gruppenblatt ganz, ein langes in Einzelblöcken', () => {
  const block = (file: string, height: number) => ({ file, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${height}"></svg>` })
  const parts = ['01-entwicklung-12-monate.png', '02-dienste-schwaechste-zuerst.png', '05-waermekarte-dienste.png']
  assert.deepEqual(pdfBlockFiles([block('00-gruppenblatt.png', 1200), ...parts.map((file) => block(file, 300))]), ['00-gruppenblatt.png'])
  assert.deepEqual(pdfBlockFiles([block('00-gruppenblatt.png', 3200), ...parts.map((file) => block(file, 300))]), parts)
})
