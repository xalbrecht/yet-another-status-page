import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_settings_report_heat_ended_style" AS ENUM('label', 'hatch');
  CREATE TYPE "public"."enum_settings_report_sheet_active_style" AS ENUM('marks', 'hints');
  ALTER TABLE "settings" ADD COLUMN "report_heat_ended_style" "enum_settings_report_heat_ended_style" DEFAULT 'label';
  ALTER TABLE "settings" ADD COLUMN "report_sheet_active_style" "enum_settings_report_sheet_active_style" DEFAULT 'marks';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "settings" DROP COLUMN "report_heat_ended_style";
  ALTER TABLE "settings" DROP COLUMN "report_sheet_active_style";
  DROP TYPE "public"."enum_settings_report_heat_ended_style";
  DROP TYPE "public"."enum_settings_report_sheet_active_style";`)
}
