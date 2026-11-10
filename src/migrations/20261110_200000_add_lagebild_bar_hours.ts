import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_settings_lagebild_bar_hours" AS ENUM('12', '24');
  ALTER TABLE "settings" ADD COLUMN "lagebild_bar_hours" "enum_settings_lagebild_bar_hours" DEFAULT '12';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "settings" DROP COLUMN "lagebild_bar_hours";
  DROP TYPE "public"."enum_settings_lagebild_bar_hours";`)
}
