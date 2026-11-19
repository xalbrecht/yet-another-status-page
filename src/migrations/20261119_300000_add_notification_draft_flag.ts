import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Haken „Meldungsentwurf anlegen“ (Feld createNotificationDraft): an der Wartung (Entwurf beim Anlegen) und an jeder Aktualisierung
// von Wartungen und Störungen. Vorgabe „angehakt“, bestehende Zeilen gelten als angehakt (der Hook prüft nur auf „false“).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "maintenances" ADD COLUMN "create_notification_draft" boolean DEFAULT true;
  ALTER TABLE "maintenances_updates" ADD COLUMN "create_notification_draft" boolean DEFAULT true;
  ALTER TABLE "incidents_updates" ADD COLUMN "create_notification_draft" boolean DEFAULT true;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "maintenances" DROP COLUMN "create_notification_draft";
  ALTER TABLE "maintenances_updates" DROP COLUMN "create_notification_draft";
  ALTER TABLE "incidents_updates" DROP COLUMN "create_notification_draft";`)
}
