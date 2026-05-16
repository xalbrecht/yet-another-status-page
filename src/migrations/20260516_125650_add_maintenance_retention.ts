import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "maintenances" ADD COLUMN "cancelled_at" timestamp(3) with time zone;
  ALTER TABLE "maintenances" ADD COLUMN "completed_at" timestamp(3) with time zone;
  ALTER TABLE "settings" ADD COLUMN "maintenance_terminal_retention_hours" numeric DEFAULT 24;
  CREATE INDEX "maintenances_cancelled_at_idx" ON "maintenances" USING btree ("cancelled_at");
  CREATE INDEX "maintenances_completed_at_idx" ON "maintenances" USING btree ("completed_at");
  CREATE INDEX "maintenances_status_idx" ON "maintenances" USING btree ("status");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "maintenances_cancelled_at_idx";
  DROP INDEX "maintenances_completed_at_idx";
  DROP INDEX "maintenances_status_idx";
  ALTER TABLE "maintenances" DROP COLUMN "cancelled_at";
  ALTER TABLE "maintenances" DROP COLUMN "completed_at";
  ALTER TABLE "settings" DROP COLUMN "maintenance_terminal_retention_hours";`)
}
