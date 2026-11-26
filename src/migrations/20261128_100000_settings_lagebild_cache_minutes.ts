import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Dauer des Zwischenspeichers des Lagebilds (Issue #284): 1, 3, 5 oder 10 Minuten, leer = Vorgabe der Installation.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_settings_lagebild_cache_minutes" AS ENUM('1', '3', '5', '10');
  ALTER TABLE "settings" ADD COLUMN "lagebild_cache_minutes" "enum_settings_lagebild_cache_minutes";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "settings" DROP COLUMN "lagebild_cache_minutes";
  DROP TYPE "public"."enum_settings_lagebild_cache_minutes";`)
}
