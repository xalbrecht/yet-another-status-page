import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkTable, checkTests, lookup, tagsForFiles, type SelectionTable } from '../../scripts/test-selection'

const table: SelectionTable = {
  geprueftePfade: ['src/**'],
  tags: { ebene: ['@admin', '@public'], bereich: ['@wartungen', '@lagebild'] },
  pfade: {
    'src/lib/maintenance/**': ['@wartungen'],
    'src/lib/lagebild*.ts': ['@lagebild'],
    'src/lib/*.ts': ['*'],
    'src/app/(frontend)/m/**': ['@wartungen'],
  },
}

test('lookup: erster passender Eintrag gilt, genauere Muster stehen vorn', () => {
  assert.equal(lookup('src/lib/lagebild-cache.ts', table.pfade)?.pattern, 'src/lib/lagebild*.ts')
  assert.equal(lookup('src/lib/utils.ts', table.pfade)?.pattern, 'src/lib/*.ts')
  assert.equal(lookup('src/lib/maintenance/timer.ts', table.pfade)?.pattern, 'src/lib/maintenance/**')
  assert.equal(lookup('src/app/(frontend)/m/[shortId]/page.tsx', table.pfade)?.pattern, 'src/app/(frontend)/m/**')
  assert.equal(lookup('src/anderes/x.ts', table.pfade), null)
})

test('checkTable: Datei ohne Eintrag, veralteter Eintrag und unbekannter Tag werden gemeldet', () => {
  const files = ['src/lib/utils.ts', 'src/lib/maintenance/timer.ts', 'src/lib/lagebild.ts', 'src/app/(frontend)/m/[id]/page.tsx']
  assert.deepEqual(checkTable(files, table), [])

  const neu = checkTable([...files, 'src/collections/Neu.ts'], table)
  assert.deepEqual(neu, ['Pfad ohne Eintrag in der Tabelle: src/collections/Neu.ts'])

  const ohneMaintenance = checkTable(['src/lib/utils.ts', 'src/lib/lagebild.ts', 'src/app/(frontend)/m/[id]/page.tsx'], table)
  assert.deepEqual(ohneMaintenance, ['Eintrag ohne passende Datei (veraltet?): src/lib/maintenance/**'])

  const falsch = checkTable(files, { ...table, pfade: { ...table.pfade, 'src/lib/*.ts': ['@gibtsnicht'] } })
  assert.deepEqual(falsch, ['Unbekannter Tag @gibtsnicht im Eintrag src/lib/*.ts'])
})

test('checkTable: Dateien außerhalb von geprueftePfade werden ignoriert', () => {
  assert.deepEqual(checkTable(['src/lib/utils.ts', 'src/lib/maintenance/a.ts', 'src/lib/lagebild.ts', 'src/app/(frontend)/m/x', 'docs/a.md'], table), [])
})

test('checkTests: genau eine Ebene, mindestens ein Bereich, nur bekannte Tags', () => {
  const ok = { file: 'a.spec.ts', title: 'ok', tags: ['admin', 'wartungen'] }
  assert.deepEqual(checkTests([ok], table), [])
  assert.equal(checkTests([{ ...ok, tags: ['wartungen'] }], table).length, 1)
  assert.equal(checkTests([{ ...ok, tags: ['admin', 'public', 'wartungen'] }], table).length, 1)
  assert.equal(checkTests([{ ...ok, tags: ['admin'] }], table).length, 1)
  assert.equal(checkTests([{ ...ok, tags: ['admin', 'wartungen', 'quatsch'] }], table).length, 1)
  assert.deepEqual(checkTests([{ ...ok, tags: ['admin', 'admin', 'wartungen'] }], table), [], 'doppelt genannt zählt einmal')
})

test('tagsForFiles: vereinigt die Tags, „*“ oder unbekannte Pfade ergeben die volle Suite (null)', () => {
  assert.deepEqual(tagsForFiles(['src/lib/maintenance/timer.ts', 'src/lib/lagebild.ts'], table), ['@lagebild', '@wartungen'])
  assert.equal(tagsForFiles(['src/lib/maintenance/timer.ts', 'src/lib/utils.ts'], table), null)
  assert.equal(tagsForFiles(['src/neu/x.ts'], table), null)
  assert.deepEqual(tagsForFiles(['docs/a.md'], table), [], 'nur Dateien außerhalb der geprüften Pfade: keine Tags nötig')
})
