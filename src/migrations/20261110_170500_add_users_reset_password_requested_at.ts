import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Payload 3.90.2 (PR #4) führt users.reset_password_requested_at ein. Die Migration add_lagebild
// enthielt die Spalte nicht, /admin lud dadurch nicht. IF NOT EXISTS: läuft auch dort, wo die Spalte
// schon von Hand ergänzt wurde.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_password_requested_at" timestamp(3) with time zone;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP COLUMN IF EXISTS "reset_password_requested_at";`)
}
