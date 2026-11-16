import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Übernimmt die Regeln, die bis hierher fest im Code standen, in die Einstellungen. Nur für Installationen, die
// schon Vorfälle haben und noch keine Regeln: ihr Verfügbarkeitsbericht ändert sich so nicht. Eine neue
// Installation startet ohne Regeln. Die Wörter passen zu deutschen Meldungsvorlagen.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   INSERT INTO "settings_classification_rules" ("_order", "_parent_id", "id", "field", "match", "classification", "words")
  SELECT r."_order", s."id", substr(md5(random()::text || r."_order"::text), 1, 24),
         r."field"::"enum_settings_classification_rules_field",
         r."match"::"enum_settings_classification_rules_match",
         r."classification"::"enum_settings_classification_rules_classification",
         r."words"
    FROM (SELECT "id" FROM "settings" ORDER BY "id" LIMIT 1) AS s,
         (VALUES
           (1, 'title', 'contains', 'maintenance', 'wartung'),
           (2, 'title', 'starts', 'none', 'hinweis'),
           (3, 'updates', 'contains', 'degraded', 'performance, ladezeit, wartezeit, langsam, verzögerung, verzögert'),
           (4, 'title', 'starts', 'major', 'vollständiger serviceausfall'),
           (5, 'title', 'starts', 'partial', 'teilweiser ausfall')
         ) AS r("_order", "field", "match", "classification", "words")
   WHERE EXISTS (SELECT 1 FROM "incidents")
     AND NOT EXISTS (SELECT 1 FROM "settings_classification_rules");`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Die übernommenen Regeln lassen sich nicht von Regeln unterscheiden, die im Admin eingetragen wurden. Es bleibt beim Ist-Stand.
}
