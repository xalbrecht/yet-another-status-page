import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Nimmt 20261115_100000_add_settings_language zurück (die Sprache kommt aus DEFAULT_LANGUAGE) und lässt
// das Feld locale leer beginnen: Leer folgt der Sprache. Der bisherige Standardwert en-US war nie bewusst
// gewählt und wird auf leer gesetzt.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "settings" DROP COLUMN IF EXISTS "language";
   ALTER TABLE "settings" ALTER COLUMN "locale" DROP DEFAULT;
   UPDATE "settings" SET "locale" = NULL WHERE "locale" = 'en-US';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "language" varchar;
   ALTER TABLE "settings" ALTER COLUMN "locale" SET DEFAULT 'en-US';
   UPDATE "settings" SET "locale" = 'en-US' WHERE "locale" IS NULL;`)
}
