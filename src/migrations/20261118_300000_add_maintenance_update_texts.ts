import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// SMS- und ntfy-Text je Aktualisierung einer Wartung (Felder smsBody und ntfyBody der Einträge), gesetzt aus einer Vorlage.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "maintenances_updates" ADD COLUMN "sms_body" varchar;
  ALTER TABLE "maintenances_updates" ADD COLUMN "ntfy_body" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "maintenances_updates" DROP COLUMN "sms_body";
  ALTER TABLE "maintenances_updates" DROP COLUMN "ntfy_body";`)
}
