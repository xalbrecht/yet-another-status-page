import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Neue Enum-Werte stehen in einer eigenen Migration: Postgres erlaubt ihre Verwendung
// erst nach dem Commit der Transaktion, die sie anlegt (siehe Folgemigration).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TYPE "public"."enum_service_groups_icon" ADD VALUE IF NOT EXISTS 'AppWindow';
  ALTER TYPE "public"."enum_service_groups_icon" ADD VALUE IF NOT EXISTS 'Languages';
  ALTER TYPE "public"."enum_service_groups_icon" ADD VALUE IF NOT EXISTS 'ClipboardCheck';
  ALTER TYPE "public"."enum_service_groups_icon" ADD VALUE IF NOT EXISTS 'HardHat';
  ALTER TYPE "public"."enum_service_groups_icon" ADD VALUE IF NOT EXISTS 'GraduationCap';
  ALTER TYPE "public"."enum_service_groups_icon" ADD VALUE IF NOT EXISTS 'Receipt';
  ALTER TYPE "public"."enum_service_groups_icon" ADD VALUE IF NOT EXISTS 'Lightbulb';
  ALTER TYPE "public"."enum_service_groups_icon" ADD VALUE IF NOT EXISTS 'Wrench';
  ALTER TYPE "public"."enum_service_groups_icon" ADD VALUE IF NOT EXISTS 'IdCard';
  ALTER TYPE "public"."enum_service_groups_icon" ADD VALUE IF NOT EXISTS 'Trees';
  ALTER TYPE "public"."enum_service_groups_icon" ADD VALUE IF NOT EXISTS 'Flower2';
  ALTER TYPE "public"."enum_service_groups_icon" ADD VALUE IF NOT EXISTS 'Map';
  ALTER TYPE "public"."enum_service_groups_icon" ADD VALUE IF NOT EXISTS 'Store';
  ALTER TYPE "public"."enum_service_groups_icon" ADD VALUE IF NOT EXISTS 'Euro';
  ALTER TYPE "public"."enum_service_groups_icon" ADD VALUE IF NOT EXISTS 'Waypoints';
  ALTER TYPE "public"."enum_service_groups_icon" ADD VALUE IF NOT EXISTS 'Car';
  ALTER TYPE "public"."enum_service_groups_icon" ADD VALUE IF NOT EXISTS 'Baby';
  ALTER TYPE "public"."enum_service_groups_icon" ADD VALUE IF NOT EXISTS 'Heart';
  ALTER TYPE "public"."enum_service_groups_icon" ADD VALUE IF NOT EXISTS 'FolderOpen';
  ALTER TYPE "public"."enum_service_groups_icon" ADD VALUE IF NOT EXISTS 'School';
  ALTER TYPE "public"."enum_service_groups_icon" ADD VALUE IF NOT EXISTS 'BookOpen';
  ALTER TYPE "public"."enum_service_groups_icon" ADD VALUE IF NOT EXISTS 'Presentation';
  ALTER TYPE "public"."enum_service_groups_icon" ADD VALUE IF NOT EXISTS 'HeartHandshake';
  ALTER TYPE "public"."enum_service_groups_icon" ADD VALUE IF NOT EXISTS 'Leaf';
  ALTER TYPE "public"."enum_service_groups_icon" ADD VALUE IF NOT EXISTS 'CalendarDays';
  ALTER TYPE "public"."enum_service_groups_icon" ADD VALUE IF NOT EXISTS 'LayoutTemplate';
  ALTER TYPE "public"."enum_service_groups_icon" ADD VALUE IF NOT EXISTS 'House';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Enum-Werte lassen sich in Postgres nicht entfernen. Das Zurücksetzen der Icons übernimmt die Folgemigration.
}
