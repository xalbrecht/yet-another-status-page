import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Art der Wartung (Feld maintenanceKind): „sla“ im Wartungsfenster, „additional“ zusätzlich. Das Feld ist Pflicht und hat keine Vorgabe.
// Bestehende Wartungen erhalten „sla“: Der Bericht rechnet sie wie bisher, solange beide Rechenarten gleich eingestellt sind.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_maintenances_maintenance_kind" AS ENUM('sla', 'additional');
  ALTER TABLE "maintenances" ADD COLUMN "maintenance_kind" "enum_maintenances_maintenance_kind";
  UPDATE "maintenances" SET "maintenance_kind" = 'sla';
  ALTER TABLE "maintenances" ALTER COLUMN "maintenance_kind" SET NOT NULL;
  CREATE INDEX "maintenances_maintenance_kind_idx" ON "maintenances" USING btree ("maintenance_kind");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "maintenances_maintenance_kind_idx";
  ALTER TABLE "maintenances" DROP COLUMN "maintenance_kind";
  DROP TYPE "public"."enum_maintenances_maintenance_kind";`)
}
