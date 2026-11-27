import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Automatisches Neuladen der öffentlichen Seite (Issue #288): aus, 1, 3, 5 oder 10 Minuten. Vorgabe „aus“, damit sich ohne
// Entscheidung des Betreibers nichts ändert.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_settings_auto_refresh_minutes" AS ENUM('off', '1', '3', '5', '10');
  ALTER TABLE "settings" ADD COLUMN "auto_refresh_minutes" "enum_settings_auto_refresh_minutes" DEFAULT 'off';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "settings" DROP COLUMN "auto_refresh_minutes";
  DROP TYPE "public"."enum_settings_auto_refresh_minutes";`)
}
