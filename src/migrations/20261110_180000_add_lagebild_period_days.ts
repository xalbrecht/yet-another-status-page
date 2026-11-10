import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_settings_lagebild_period_days" AS ENUM('14', '30', '90', '180', '365');
  ALTER TABLE "settings" ADD COLUMN "lagebild_period_days" "enum_settings_lagebild_period_days" DEFAULT '14';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "settings" DROP COLUMN "lagebild_period_days";
  DROP TYPE "public"."enum_settings_lagebild_period_days";`)
}
