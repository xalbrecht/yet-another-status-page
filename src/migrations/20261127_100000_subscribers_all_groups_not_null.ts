import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Abonnenten: `all_groups` wird Pflicht (Issue #276). Ein leerer Wert galt weder als „alle Dienstgruppen“ noch als
// Auswahl, der Abonnent erhielt Meldungen mit Gruppenbezug nie. Vorhandene leere Werte werden „alle Dienstgruppen“.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   UPDATE "subscribers" SET "all_groups" = true WHERE "all_groups" IS NULL;
  ALTER TABLE "subscribers" ALTER COLUMN "all_groups" SET NOT NULL;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "subscribers" ALTER COLUMN "all_groups" DROP NOT NULL;`)
}
