import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Optionale ntfy-Nachricht an der Benachrichtigung (Feld ntfyBody), von Anbindungen lesbar, die gesendete Benachrichtigungen abholen.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "notifications" ADD COLUMN "ntfy_body" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "notifications" DROP COLUMN "ntfy_body";`)
}
