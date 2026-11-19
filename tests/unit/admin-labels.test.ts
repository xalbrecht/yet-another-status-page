import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as collections from '../../src/collections'
import * as globals from '../../src/globals'

// Fehlt `label`, leitet Payload die Beschriftung aus dem Feldnamen ab, und sie bleibt im Admin englisch (Issue #191).
// Der Test läuft über die echten Exporte, nicht über den Quelltext.

type AnyField = {
  name?: string
  type?: string
  label?: unknown
  options?: (string | { label?: unknown })[]
  fields?: AnyField[]
  tabs?: { name?: string; label?: unknown; fields: AnyField[] }[]
  blocks?: { slug: string; labels?: unknown; fields: AnyField[] }[]
  admin?: { hidden?: boolean }
}

function findUnlabeled(fields: AnyField[], path: string): string[] {
  const out: string[] = []
  for (const f of fields) {
    const here = f.name ? `${path}.${f.name}` : path
    if (f.name && f.type !== 'ui' && !f.admin?.hidden && f.label === undefined) out.push(`Feld ohne label: ${here}`)
    if (f.type === 'select' || f.type === 'radio') {
      for (const o of f.options ?? []) {
        if (typeof o === 'string' || o.label === undefined) out.push(`Option ohne label: ${here} ${JSON.stringify(o)}`)
      }
    }
    if (f.fields) out.push(...findUnlabeled(f.fields, here))
    for (const t of f.tabs ?? []) {
      if (t.label === undefined) out.push(`Tab ohne label: ${here}${t.name ? `.${t.name}` : ''}`)
      out.push(...findUnlabeled(t.fields, t.name ? `${here}.${t.name}` : here))
    }
    for (const b of f.blocks ?? []) {
      if (b.labels === undefined) out.push(`Block ohne labels: ${here}<${b.slug}>`)
      out.push(...findUnlabeled(b.fields, `${here}<${b.slug}>`))
    }
  }
  return out
}

test('alle sichtbaren Felder der Collections und Globals haben ein label', () => {
  const treffer: string[] = []
  for (const c of Object.values(collections) as { slug: string; labels?: unknown; fields: AnyField[] }[]) {
    if (!c.labels) treffer.push(`Collection ohne labels: ${c.slug}`)
    treffer.push(...findUnlabeled(c.fields, c.slug))
  }
  for (const g of Object.values(globals) as { slug: string; label?: unknown; fields: AnyField[] }[]) {
    if (g.label === undefined) treffer.push(`Global ohne label: ${g.slug}`)
    treffer.push(...findUnlabeled(g.fields, g.slug))
  }
  assert.deepEqual(treffer, [])
})

test('der Test erkennt fehlende Beschriftungen (Gegenprobe)', () => {
  const fields: AnyField[] = [
    { name: 'ok', type: 'text', label: 'Ok' },
    { name: 'nackt', type: 'text' },
    { name: 'versteckt', type: 'text', admin: { hidden: true } },
    { name: 'art', type: 'select', label: 'Art', options: ['a', { label: 'B' }, {}] },
    { type: 'tabs', tabs: [{ fields: [{ name: 'im-tab', type: 'text' }] }] },
    { type: 'blocks', name: 'bl', label: 'Bl', blocks: [{ slug: 'x', fields: [] }] },
  ]
  assert.deepEqual(findUnlabeled(fields, 'c'), [
    'Feld ohne label: c.nackt',
    'Option ohne label: c.art "a"',
    'Option ohne label: c.art {}',
    'Tab ohne label: c',
    'Feld ohne label: c.im-tab',
    'Block ohne labels: c.bl<x>',
  ])
})
