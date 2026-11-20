import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Zustand vor dem Vorfall (Feld statusBeforeIncident am Dienst, Issue #210): leer, bis ein Vorfall den Dienst erfasst.
// Bei Vorfällen, die zur Zeit der Migration schon offen sind, bleibt das Feld leer (der Dienstzustand stammt schon aus dem Vorfall).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_services_status_before_incident" AS ENUM('operational', 'degraded', 'partial', 'major');
  ALTER TABLE "services" ADD COLUMN "status_before_incident" "enum_services_status_before_incident";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "services" DROP COLUMN "status_before_incident";
  DROP TYPE "public"."enum_services_status_before_incident";`)
}
