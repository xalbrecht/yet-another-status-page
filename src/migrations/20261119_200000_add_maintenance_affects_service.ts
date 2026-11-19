import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Auswirkung auf den Dienst (Feld affectsService): Kontrollkästchen, Vorgabe „nein“. Bestehende Wartungen bleiben ohne Auswirkung.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "maintenances" ADD COLUMN "affects_service" boolean DEFAULT false;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "maintenances" DROP COLUMN "affects_service";`)
}
