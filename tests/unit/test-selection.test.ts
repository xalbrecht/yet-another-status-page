import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkTable, checkTests, decideSelection, lookup, tagsForFiles, type ListedTest, type SelectionTable } from '../../scripts/test-selection'

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

const tests: ListedTest[] = [
  { file: 'a.spec.ts', title: 'a1', tags: ['@admin', '@wartungen'] },
  { file: 'b.spec.ts', title: 'b1', tags: ['@public', '@lagebild'] },
  { file: 'c.spec.ts', title: 'c1', tags: ['@api', '@lagebild'] },
]
const pr = (changed: string[], labels: string[] = []) =>
  decideSelection({ event: 'pull_request', labels, changed, tests, table })

test('decideSelection: Push auf main und Label e2e:alles ergeben die volle Suite', () => {
  const push = decideSelection({ event: 'push', labels: [], changed: ['src/lib/maintenance/timer.ts'], tests, table })
  assert.equal(push.mode, 'all')
  assert.match(push.reason, /main/)
  assert.equal(pr(['src/lib/maintenance/timer.ts'], ['e2e:alles']).mode, 'all')
})

test('decideSelection: Dateien, die alle Tests betreffen, ergeben die volle Suite', () => {
  for (const f of ['package.json', 'package-lock.json', 'playwright.config.ts', 'tests/utils/helper.ts', '.github/workflows/x.yml', 'tests/seed/seed-test-data.mjs']) {
    const r = pr([f])
    assert.equal(r.mode, 'all', f)
    assert.match(r.reason, new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('decideSelection: Pfad mit „*“ oder ohne Eintrag ergibt die volle Suite, auch in Mischung', () => {
  assert.equal(pr(['src/lib/utils.ts']).mode, 'all')
  assert.equal(pr(['src/neu/x.ts']).mode, 'all')
  assert.equal(pr(['src/lib/maintenance/timer.ts', 'src/lib/utils.ts']).mode, 'all')
})

test('decideSelection: gezielte Pfade wählen die Testdateien mit den Tags', () => {
  const a = pr(['src/lib/maintenance/timer.ts'])
  assert.deepEqual(a.mode === 'some' && a.files, ['tests/e2e/a.spec.ts'])
  assert.equal(a.mode === 'some' && a.needsLockCheck, true)
  const b = pr(['src/lib/lagebild.ts'])
  assert.deepEqual(b.mode === 'some' && b.files, ['tests/e2e/b.spec.ts', 'tests/e2e/c.spec.ts'])
})

test('decideSelection: ohne passende Tags und ohne geänderte Testdatei läuft nichts', () => {
  assert.equal(pr(['scripts/x.ts']).mode, 'none')
  assert.equal(pr(['tests/e2e/gone.spec.ts']).mode, 'none', 'gelöschte Testdatei kommt in der Liste nicht vor')
})

test('decideSelection: geänderte Testdateien laufen immer mit', () => {
  const r = pr(['scripts/x.ts', 'tests/e2e/b.spec.ts'])
  assert.deepEqual(r.mode === 'some' && r.files, ['tests/e2e/b.spec.ts'])
  assert.equal(r.mode === 'some' && r.needsLockCheck, false)
})

test('decideSelection: Tags ohne passende Testdatei ergeben die volle Suite (Fail-Safe)', () => {
  const r = decideSelection({ event: 'pull_request', labels: [], changed: ['src/lib/maintenance/timer.ts'], tests: tests.slice(1), table })
  assert.equal(r.mode, 'all')
})
