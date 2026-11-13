import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_settings_status_box_content" AS ENUM('full', 'compact');
  CREATE TYPE "public"."enum_settings_status_boxes_placement" AS ENUM('before', 'after');
  ALTER TABLE "settings" ADD COLUMN "status_box_entries" numeric DEFAULT 3;
  ALTER TABLE "settings" ADD COLUMN "status_box_content" "enum_settings_status_box_content" DEFAULT 'full';
  ALTER TABLE "settings" ADD COLUMN "status_boxes_placement" "enum_settings_status_boxes_placement" DEFAULT 'before';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "settings" DROP COLUMN "status_box_entries";
  ALTER TABLE "settings" DROP COLUMN "status_box_content";
  ALTER TABLE "settings" DROP COLUMN "status_boxes_placement";
  DROP TYPE "public"."enum_settings_status_box_content";
  DROP TYPE "public"."enum_settings_status_boxes_placement";`)
}
