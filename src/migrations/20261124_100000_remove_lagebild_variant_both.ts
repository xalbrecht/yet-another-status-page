import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Testmodus „Beide“ der Lagebild-Darstellung entfällt (Issue #21): bestehende Einstellung „both“ wird zu „b“,
// der Wert verschwindet aus dem Aufzählungstyp.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   UPDATE "settings" SET "lagebild_variant" = 'b' WHERE "lagebild_variant" = 'both';
  ALTER TABLE "settings" ALTER COLUMN "lagebild_variant" DROP DEFAULT;
  ALTER TYPE "public"."enum_settings_lagebild_variant" RENAME TO "enum_settings_lagebild_variant_old";
  CREATE TYPE "public"."enum_settings_lagebild_variant" AS ENUM('off', 'a', 'b');
  ALTER TABLE "settings" ALTER COLUMN "lagebild_variant" TYPE "public"."enum_settings_lagebild_variant" USING "lagebild_variant"::text::"public"."enum_settings_lagebild_variant";
  ALTER TABLE "settings" ALTER COLUMN "lagebild_variant" SET DEFAULT 'off';
  DROP TYPE "public"."enum_settings_lagebild_variant_old";`)
}

// Der Wert „both“ ist zurück im Typ, die auf „b“ umgestellten Einstellungen bleiben „b“.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "settings" ALTER COLUMN "lagebild_variant" DROP DEFAULT;
  ALTER TYPE "public"."enum_settings_lagebild_variant" RENAME TO "enum_settings_lagebild_variant_old";
  CREATE TYPE "public"."enum_settings_lagebild_variant" AS ENUM('off', 'a', 'b', 'both');
  ALTER TABLE "settings" ALTER COLUMN "lagebild_variant" TYPE "public"."enum_settings_lagebild_variant" USING "lagebild_variant"::text::"public"."enum_settings_lagebild_variant";
  ALTER TABLE "settings" ALTER COLUMN "lagebild_variant" SET DEFAULT 'off';
  DROP TYPE "public"."enum_settings_lagebild_variant_old";`)
}
