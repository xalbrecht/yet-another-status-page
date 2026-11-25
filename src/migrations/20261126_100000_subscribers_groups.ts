import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Gruppenwahl der Abonnenten (Issue #268): „alle Dienstgruppen“ (Haken) oder eine Auswahl von Dienstgruppen.
// Bestehende Abonnenten bekommen „alle Dienstgruppen“ und erhalten weiter jede Meldung.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "subscribers_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"service_groups_id" integer
  );

  ALTER TABLE "subscribers" ADD COLUMN "all_groups" boolean DEFAULT true;
  UPDATE "subscribers" SET "all_groups" = true WHERE "all_groups" IS NULL;

  ALTER TABLE "subscribers_rels" ADD CONSTRAINT "subscribers_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."subscribers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "subscribers_rels" ADD CONSTRAINT "subscribers_rels_service_groups_fk" FOREIGN KEY ("service_groups_id") REFERENCES "public"."service_groups"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "subscribers_rels_order_idx" ON "subscribers_rels" USING btree ("order");
  CREATE INDEX "subscribers_rels_parent_idx" ON "subscribers_rels" USING btree ("parent_id");
  CREATE INDEX "subscribers_rels_path_idx" ON "subscribers_rels" USING btree ("path");
  CREATE INDEX "subscribers_rels_service_groups_id_idx" ON "subscribers_rels" USING btree ("service_groups_id");`)
}

// Die Gruppenwahl geht verloren, alle Abonnenten erhalten danach wieder jede Meldung.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "subscribers_rels" CASCADE;
  ALTER TABLE "subscribers" DROP COLUMN "all_groups";`)
}
