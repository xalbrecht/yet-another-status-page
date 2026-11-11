import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "subscribers" ADD COLUMN "address_confirmed" boolean DEFAULT false;
  UPDATE "subscribers" SET "address_confirmed" = true;
  ALTER TABLE "email_settings" ADD COLUMN "subscriber_request_to" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "email_settings" DROP COLUMN "subscriber_request_to";
  ALTER TABLE "subscribers" DROP COLUMN "address_confirmed";`)
}
