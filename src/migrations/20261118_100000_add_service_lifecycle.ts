import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Beginn (Pflicht) und Ende (optional) an Diensten. Bestehende Dienste bekommen als Beginn das früheste von:
// 01.01.2025, erstem Eintrag im Statusprotokoll, Anlegedatum.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "services" ADD COLUMN "starts_at" timestamp(3) with time zone;
   ALTER TABLE "services" ADD COLUMN "ends_at" timestamp(3) with time zone;
   UPDATE "services" s SET "starts_at" = LEAST(
     '2025-01-01T00:00:00Z'::timestamptz,
     s."created_at",
     COALESCE((SELECT MIN(e."changed_at") FROM "service_status_events" e WHERE e."service_id" = s."id"), s."created_at")
   );
   ALTER TABLE "services" ALTER COLUMN "starts_at" SET NOT NULL;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "services" DROP COLUMN "ends_at";
   ALTER TABLE "services" DROP COLUMN "starts_at";`)
}
