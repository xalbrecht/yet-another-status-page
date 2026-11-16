import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SEED_TEMPLATES, up, down } from '@/migrations/20261116_700000_seed_message_templates'
import { checkTemplateText, formatServiceList, isStatusOfKind, renderTemplate } from '@/lib/message-templates'
import { NTFY_TEXT_MAX_LENGTH, SMS_TEXT_MAX_LENGTH } from '@/collections/MessageTemplates'

test('es sind elf Vorlagen: acht Störungen und drei Wartungen, jeder Name einmal', () => {
  assert.equal(SEED_TEMPLATES.length, 11)
  assert.equal(new Set(SEED_TEMPLATES.map((t) => t.name)).size, 11)
  assert.equal(SEED_TEMPLATES.filter((t) => t.kind === 'incident').length, 8)
  assert.equal(SEED_TEMPLATES.filter((t) => t.kind === 'maintenance').length, 3)
})

test('jede Vorlage besteht dieselben Prüfungen wie beim Speichern in der Collection', () => {
  for (const t of SEED_TEMPLATES) {
    assert.ok(isStatusOfKind(t.kind, t.status), `${t.name}: Status gehört zur Art`)
    assert.deepEqual(checkTemplateText(t.title, { required: true, kind: t.kind }), { ok: true }, `${t.name}: Titel`)
    assert.deepEqual(checkTemplateText(t.body, { required: true, kind: t.kind }), { ok: true }, `${t.name}: Text`)
    assert.deepEqual(checkTemplateText(t.smsBody, { required: false, kind: t.kind, maxLength: SMS_TEXT_MAX_LENGTH }), { ok: true }, `${t.name}: SMS`)
    assert.deepEqual(checkTemplateText(t.ntfyBody, { required: false, kind: t.kind, maxLength: NTFY_TEXT_MAX_LENGTH }), { ok: true }, `${t.name}: ntfy`)
  }
})

test('die Auswirkung ist nur bei Störungen gesetzt und nur eine der drei Stufen', () => {
  for (const t of SEED_TEMPLATES) {
    if (t.kind === 'maintenance') assert.equal(t.impact, null, t.name)
    else assert.ok(t.impact === null || ['degraded', 'partial', 'major'].includes(t.impact), t.name)
  }
  assert.deepEqual(
    SEED_TEMPLATES.filter((t) => t.impact !== null).map((t) => [t.name, t.impact]),
    [
      ['Wird untersucht: Mögliche Serviceunterbrechung', 'degraded'],
      ['Wird untersucht: Teilweiser Ausfall', 'partial'],
      ['Wird untersucht: Vollständiger Serviceausfall', 'major'],
    ],
  )
})

test('jeder Text nennt die betroffenen Dienste, und ein Text, der {{link}} nutzt, ist nur im SMS-Text', () => {
  for (const t of SEED_TEMPLATES) {
    assert.ok(t.title.includes('{{services}}'), `${t.name}: Titel nennt die Dienste`)
    assert.ok(t.body.includes('{{services}}'), `${t.name}: Text nennt die Dienste`)
    assert.ok(t.smsBody.includes('{{services}}'), `${t.name}: SMS nennt die Dienste`)
    assert.ok(t.smsBody.includes('{{link}}'), `${t.name}: SMS trägt den Link`)
  }
})

test('mit drei langen Dienstnamen und einem Link bleibt jeder SMS-Text in den zwei Segmenten und jeder ntfy-Text unter der Grenze', () => {
  const services = formatServiceList(['Fachverfahren Beispiel A', 'Fachverfahren Beispiel B', 'Fachverfahren Beispiel C'], 'de-DE')
  const values = { services, group: 'Fachverfahren', impact: 'Teilausfall', start: '17. Nov. 2026, 20:00 UTC', end: '17. Nov. 2026, 22:00 UTC', link: 'https://status.example.org/i/abc12345' }
  for (const t of SEED_TEMPLATES) {
    assert.ok(renderTemplate(t.smsBody, values).length <= 320, `${t.name}: SMS ${renderTemplate(t.smsBody, values).length} Zeichen`)
    assert.ok(renderTemplate(t.ntfyBody, values).length <= NTFY_TEXT_MAX_LENGTH, `${t.name}: ntfy`)
    assert.ok(!/\{\{/.test(renderTemplate(t.smsBody, values)), `${t.name}: kein Platzhalter bleibt stehen`)
  }
})

/** Lauf-Ersatz, der die Anweisungen mitschreibt. `muster`: ob Entwürfe „MUSTER – …“ vorhanden sind. */
function fakeDb(muster: boolean) {
  const statements: string[] = []
  return {
    statements,
    db: {
      execute: async (query: { queryChunks?: unknown[] }) => {
        statements.push(JSON.stringify(query.queryChunks ?? query).slice(0, 4000))
        return { rows: muster && statements.length === 1 ? [{ '?column?': 1 }] : [] }
      },
    },
  }
}

test('die Migration tut nichts, wenn keine Muster als Entwürfe vorhanden sind', async () => {
  const { db, statements } = fakeDb(false)
  await up({ db } as never)
  assert.equal(statements.length, 1, 'nur die Abfrage nach den Mustern')
})

test('sind Muster vorhanden, legt sie jede der elf Vorlagen mit einer Anweisung an', async () => {
  const { db, statements } = fakeDb(true)
  await up({ db } as never)
  assert.equal(statements.length, 1 + 11)
  assert.ok(statements.slice(1).every((s) => /INSERT INTO message_templates/.test(s)))
  assert.ok(statements.slice(1).every((s) => /WHERE NOT EXISTS/.test(s)), 'jede Anweisung legt nur an, wenn der Name fehlt')
})

test('der Rückweg löscht genau die elf Vorlagen nach Namen und nichts anderes', async () => {
  const { db, statements } = fakeDb(true)
  await down({ db } as never)
  assert.equal(statements.length, 11)
  assert.ok(statements.every((s) => /DELETE FROM message_templates WHERE name =/.test(s)))
  assert.ok(!statements.some((s) => /notifications/.test(s)), 'die Benachrichtigungen bleiben unberührt')
})
