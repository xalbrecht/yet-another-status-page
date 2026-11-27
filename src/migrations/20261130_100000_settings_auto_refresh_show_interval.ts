import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Anzeige des Stands (Issue #300): Der Betreiber entscheidet, ob sie den Takt des Neuladens nennt. Vorgabe nein.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "settings" ADD COLUMN "auto_refresh_show_interval" boolean DEFAULT false;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "settings" DROP COLUMN "auto_refresh_show_interval";`)
}
