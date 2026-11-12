import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_service_status_events_source" AS ENUM('operation', 'reconstructed');
  ALTER TABLE "service_status_events" ADD COLUMN "source" "enum_service_status_events_source" DEFAULT 'operation' NOT NULL;
  ALTER TABLE "settings" ADD COLUMN "availability_target" numeric DEFAULT 99;
  ALTER TABLE "service_groups" ADD COLUMN "availability_target" numeric;
  ALTER TABLE "services" ADD COLUMN "availability_target" numeric;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "services" DROP COLUMN "availability_target";
  ALTER TABLE "service_groups" DROP COLUMN "availability_target";
  ALTER TABLE "settings" DROP COLUMN "availability_target";
  ALTER TABLE "service_status_events" DROP COLUMN "source";
  DROP TYPE "public"."enum_service_status_events_source";`)
}
