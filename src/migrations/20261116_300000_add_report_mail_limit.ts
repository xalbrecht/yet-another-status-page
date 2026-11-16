import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Größengrenze je Mail im Versand des Verfügbarkeitsberichts (Megabyte). Vorhandene Installationen behalten 6 MB.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "email_settings" ADD COLUMN "report_mail_limit_mb" numeric DEFAULT 6;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "email_settings" DROP COLUMN "report_mail_limit_mb";`)
}
