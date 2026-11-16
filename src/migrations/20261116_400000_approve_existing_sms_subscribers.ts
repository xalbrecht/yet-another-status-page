import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// SMS-Abonnenten erhalten Meldungen ab jetzt nur mit Freigabe (verified). Vorhandene SMS-Abonnenten
// gelten als freigegeben, damit sie weiter Meldungen bekommen.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   UPDATE "subscribers" SET "verified" = true WHERE "type" = 'sms';`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Die gesetzte Freigabe lässt sich nicht von einer Freigabe von Hand unterscheiden. Es bleibt beim Ist-Stand.
}
