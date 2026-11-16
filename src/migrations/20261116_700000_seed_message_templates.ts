import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Legt die Standardtexte des Betreibers als Vorlagen an (Collection message-templates): die acht bisherigen Muster aus den
 * Entwürfen der Benachrichtigungen („MUSTER – …“), neu formuliert für einen und mehrere Dienste, dazu drei ergänzende.
 * Die Migration enthält deutsche Texte und Daten des Betreibers und bleibt im Fork, sie gehört nicht in den Upstream.
 * Sie läuft nur, wenn solche Entwürfe vorhanden sind, legt jede Vorlage höchstens einmal an (nach Name) und löscht
 * keine Benachrichtigung. Die alten Entwürfe bleiben stehen, bis jemand sie ausdrücklich entfernt.
 */
type SeedTemplate = {
  name: string
  kind: 'incident' | 'maintenance'
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved' | 'upcoming' | 'in_progress' | 'completed' | 'cancelled'
  impact: 'degraded' | 'partial' | 'major' | null
  title: string
  body: string
  smsBody: string
  ntfyBody: string
}

const lines = (...parts: string[]) => parts.join('\n')

export const SEED_TEMPLATES: SeedTemplate[] = [
  {
    name: 'Wird untersucht: Analyse läuft',
    kind: 'incident',
    status: 'investigating',
    impact: null,
    title: 'Störung {{services}} – Analysephase',
    body: lines(
      'Derzeit liegt eine Störung vor. Folgende(r) Service(s) sind betroffen: {{services}}.',
      'Wir analysieren die Störung. Sobald neue Informationen vorliegen, informieren wir Sie umgehend.',
    ),
    smsBody: 'Störung: {{services}}. Wir analysieren die Ursache. {{link}}',
    ntfyBody: 'Störung: {{services}}. Wir analysieren die Ursache.',
  },
  {
    name: 'Wird untersucht: Mögliche Serviceunterbrechung',
    kind: 'incident',
    status: 'investigating',
    impact: 'degraded',
    title: 'Mögliche Serviceunterbrechung: {{services}}',
    body: lines(
      'Wir untersuchen derzeit Meldungen zu einer möglichen Serviceunterbrechung. Folgende(r) Service(s) sind betroffen: {{services}}.',
      'Wir entschuldigen uns für etwaige Unannehmlichkeiten und stellen so bald wie möglich aktualisierte Informationen zur Verfügung.',
    ),
    smsBody: 'Mögliche Unterbrechung: {{services}}. Wir untersuchen gemeldete Probleme. {{link}}',
    ntfyBody: 'Mögliche Unterbrechung bei {{services}}: Untersuchung läuft.',
  },
  {
    name: 'Wird untersucht: Teilweiser Ausfall',
    kind: 'incident',
    status: 'investigating',
    impact: 'partial',
    title: 'Teilweiser Ausfall: {{services}}',
    body: lines(
      'Derzeit kommt es zu Einschränkungen bei der Nutzung. Folgende(r) Service(s) sind betroffen: {{services}}. Benutzer können betroffen sein.',
      'Unser Team arbeitet an der Wiederherstellung des gewohnten Leistungsniveaus.',
      'Wir bitten um Entschuldigung für etwaige Unannehmlichkeiten und stellen so bald wie möglich aktualisierte Informationen zur Verfügung.',
    ),
    smsBody: 'Teilausfall: {{services}}. Wir arbeiten an der Wiederherstellung. {{link}}',
    ntfyBody: 'Teilausfall bei {{services}}. Wir arbeiten an der Wiederherstellung.',
  },
  {
    name: 'Wird untersucht: Vollständiger Serviceausfall',
    kind: 'incident',
    status: 'investigating',
    impact: 'major',
    title: 'Vollständiger Serviceausfall: {{services}}',
    body: lines(
      'Derzeit kommt es zu einem vollständigen Ausfall. Folgende(r) Service(s) sind betroffen: {{services}}.',
      'Unser Team arbeitet an der Wiederherstellung.',
      'Wir entschuldigen uns für etwaige Unannehmlichkeiten und stellen so bald wie möglich aktualisierte Informationen zur Verfügung.',
    ),
    smsBody: 'Vollständiger Ausfall: {{services}}. Wir arbeiten an der Wiederherstellung. {{link}}',
    ntfyBody: 'Vollständiger Ausfall: {{services}}. Wir arbeiten an der Wiederherstellung.',
  },
  {
    name: 'Wird untersucht: weiterhin offen',
    kind: 'incident',
    status: 'investigating',
    impact: null,
    title: 'Zwischenmeldung Störung {{services}} – weiterhin offen',
    body: lines(
      'Es liegt nach wie vor eine Störung vor. Folgende(r) Service(s) sind betroffen: {{services}}. Die Ursache konnte noch nicht abschließend geklärt werden.',
      'Wir bitten weiterhin um Geduld und informieren Sie umgehend, sobald nähere Informationen vorliegen.',
    ),
    smsBody: 'Störung bei {{services}} weiterhin offen. Ursache noch nicht geklärt. {{link}}',
    ntfyBody: '{{services}}: Störung weiterhin offen, Ursache noch nicht geklärt.',
  },
  {
    name: 'Ursache gefunden: Ursache lokalisiert',
    kind: 'incident',
    status: 'identified',
    impact: null,
    title: 'Zwischenmeldung Störung {{services}} – Ursache lokalisiert',
    body: lines(
      'Die Ursache der Störung wurde lokalisiert. Folgende(r) Service(s) sind betroffen: {{services}}.',
      'Wir arbeiten mit Hochdruck an der Lösung und informieren Sie umgehend, sobald weitere Informationen vorliegen.',
    ),
    smsBody: 'Ursache der Störung bei {{services}} lokalisiert. Wir arbeiten an der Lösung. {{link}}',
    ntfyBody: '{{services}}: Ursache lokalisiert, wir arbeiten an der Lösung.',
  },
  {
    name: 'Wird beobachtet: Lösung eingespielt',
    kind: 'incident',
    status: 'monitoring',
    impact: null,
    title: 'Zwischenmeldung Störung {{services}} – wird beobachtet',
    body: lines(
      'Eine Lösung wurde eingespielt. Folgende(r) Service(s) sind betroffen: {{services}}. Wir beobachten derzeit, ob sich der Betrieb stabilisiert.',
      'Wir informieren Sie, sobald die Störung abschließend behoben ist.',
    ),
    smsBody: 'Lösung eingespielt für {{services}}. Wir beobachten die Stabilität. {{link}}',
    ntfyBody: '{{services}}: Lösung eingespielt, wir beobachten.',
  },
  {
    name: 'Behoben: Störung behoben',
    kind: 'incident',
    status: 'resolved',
    impact: null,
    title: 'Gutmeldung – Störung {{services}} behoben',
    body: lines(
      'Die Störung wurde behoben. Betroffen war: {{services}}. Der Betrieb ist wieder in vollem Umfang möglich.',
      'Wir bitten Sie, die Unannehmlichkeiten zu entschuldigen, und danken Ihnen für Ihre Geduld.',
    ),
    smsBody: 'Störung behoben: {{services}}. Der Betrieb ist wieder normal. {{link}}',
    ntfyBody: 'Behoben: {{services}}. Der Betrieb ist wieder normal.',
  },
  {
    name: 'Wartung geplant',
    kind: 'maintenance',
    status: 'upcoming',
    impact: null,
    title: 'Geplante Wartung: {{services}}',
    body: lines(
      'Geplante Wartungsarbeiten: Folgende(r) Service(s) sind betroffen: {{services}}.',
      'Zeitraum: {{start}} bis {{end}}. In dieser Zeit können die Services nicht oder nur eingeschränkt verfügbar sein.',
    ),
    smsBody: 'Geplante Wartung {{start}} bis {{end}}: {{services}}. {{link}}',
    ntfyBody: 'Wartung geplant {{start}} bis {{end}}: {{services}}.',
  },
  {
    name: 'Wartung: Nichtverfügbarkeit',
    kind: 'maintenance',
    status: 'in_progress',
    impact: null,
    title: 'Wartungsarbeiten: {{services}} nicht verfügbar',
    body: lines(
      'Aufgrund von Wartungsarbeiten sind derzeit folgende(r) Service(s) nicht verfügbar: {{services}}.',
      'Wir entschuldigen uns für etwaige Unannehmlichkeiten und stellen so bald wie möglich aktualisierte Informationen zur Verfügung.',
    ),
    smsBody: 'Wartungsarbeiten: {{services}} derzeit nicht verfügbar. {{link}}',
    ntfyBody: 'Wartung: {{services}} derzeit nicht verfügbar.',
  },
  {
    name: 'Wartung abgeschlossen',
    kind: 'maintenance',
    status: 'completed',
    impact: null,
    title: 'Wartung abgeschlossen: {{services}}',
    body: lines(
      'Die Wartungsarbeiten sind abgeschlossen. Betroffen waren: {{services}}. Der Betrieb ist wieder in vollem Umfang möglich.',
      'Wir danken Ihnen für Ihr Verständnis.',
    ),
    smsBody: 'Wartung abgeschlossen: {{services}}. Der Betrieb ist wieder normal. {{link}}',
    ntfyBody: 'Wartung abgeschlossen: {{services}}.',
  },
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Nur dort, wo die Muster als Entwürfe vorhanden sind (Daten des Betreibers)
  const found = await db.execute(sql`SELECT 1 FROM notifications WHERE title LIKE 'MUSTER%' LIMIT 1`)
  if (found.rows.length === 0) return
  for (const template of SEED_TEMPLATES) {
    await db.execute(sql`
      INSERT INTO message_templates (name, kind, status, impact, title, body, sms_body, ntfy_body)
      SELECT ${template.name}, ${template.kind}::enum_message_templates_kind, ${template.status}::enum_message_templates_status,
             ${template.impact}::enum_message_templates_impact, ${template.title}, ${template.body}, ${template.smsBody}, ${template.ntfyBody}
      WHERE NOT EXISTS (SELECT 1 FROM message_templates WHERE name = ${template.name})`)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const template of SEED_TEMPLATES) {
    await db.execute(sql`DELETE FROM message_templates WHERE name = ${template.name}`)
  }
}
