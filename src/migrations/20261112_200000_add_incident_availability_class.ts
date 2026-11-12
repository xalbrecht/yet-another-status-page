import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_incidents_availability_class" AS ENUM('auto', 'none', 'degraded', 'partial', 'major');
  ALTER TABLE "incidents" ADD COLUMN "availability_class" "enum_incidents_availability_class" DEFAULT 'auto';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "incidents" DROP COLUMN "availability_class";
  DROP TYPE "public"."enum_incidents_availability_class";`)
}
