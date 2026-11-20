import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Auswahl je Dienst beim Beenden eines Vorfalls (Feld serviceChoices, Issue #210): Zeilen aus Dienst und Haken „Zurück zum Zustand vor dem Vorfall“.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "incidents_service_choices" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"service_id" integer,
  	"restore" boolean DEFAULT true
  );

  ALTER TABLE "incidents_service_choices" ADD CONSTRAINT "incidents_service_choices_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "incidents_service_choices" ADD CONSTRAINT "incidents_service_choices_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "incidents_service_choices_order_idx" ON "incidents_service_choices" USING btree ("_order");
  CREATE INDEX "incidents_service_choices_parent_id_idx" ON "incidents_service_choices" USING btree ("_parent_id");
  CREATE INDEX "incidents_service_choices_service_idx" ON "incidents_service_choices" USING btree ("service_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "incidents_service_choices" CASCADE;`)
}
