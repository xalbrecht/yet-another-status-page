import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Kennzeichen „Testdatensatz“ (Feld isTest) an Benutzern und Abonnenten. Bestehende Zeilen gelten als „aus“.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "is_test" boolean DEFAULT false;
   ALTER TABLE "subscribers" ADD COLUMN "is_test" boolean DEFAULT false;
   UPDATE "users" SET "is_test" = false WHERE "is_test" IS NULL;
   UPDATE "subscribers" SET "is_test" = false WHERE "is_test" IS NULL;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "subscribers" DROP COLUMN "is_test";
   ALTER TABLE "users" DROP COLUMN "is_test";`)
}
