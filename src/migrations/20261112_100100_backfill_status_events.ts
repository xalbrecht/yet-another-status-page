import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Diese Migration rechnete das Statusprotokoll für die Zeit vor dem ersten Betriebseintrag von selbst aus den
 * Vorfällen nach, mit fest eingebauten Regeln. Die Regeln stehen jetzt in den Einstellungen, und die Nachrechnung
 * läuft nur noch auf Klick unter „Statusprotokoll pflegen“. `up` tut deshalb nichts mehr. Datenbanken, in denen
 * die frühere Fassung schon lief, behalten ihre nachgerechneten Einträge.
 */
export async function up(_args: MigrateUpArgs): Promise<void> {}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DELETE FROM service_status_events WHERE source = 'reconstructed'`)
}
