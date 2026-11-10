import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_incidents_impact" AS ENUM('degraded', 'partial', 'major');
  CREATE TYPE "public"."enum_service_groups_icon" AS ENUM('LayoutGrid', 'Server', 'Database', 'HardDrive', 'Cpu', 'Cloud', 'Network', 'Wifi', 'Globe', 'Mail', 'Phone', 'Smartphone', 'Monitor', 'Printer', 'ShieldCheck', 'Lock', 'Users', 'FileText', 'Landmark', 'Building2');
  CREATE TYPE "public"."enum_service_status_events_status" AS ENUM('operational', 'degraded', 'partial', 'major', 'maintenance');
  CREATE TYPE "public"."enum_settings_lagebild_variant" AS ENUM('off', 'a', 'b', 'both');
  CREATE TABLE "service_status_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"service_id" integer NOT NULL,
  	"status" "enum_service_status_events_status" NOT NULL,
  	"changed_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "incidents" ADD COLUMN "impact" "enum_incidents_impact" DEFAULT 'degraded' NOT NULL;
  ALTER TABLE "service_groups" ADD COLUMN "icon" "enum_service_groups_icon" DEFAULT 'LayoutGrid';
  ALTER TABLE "settings" ADD COLUMN "lagebild_variant" "enum_settings_lagebild_variant" DEFAULT 'off';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "service_status_events_id" integer;
  ALTER TABLE "service_status_events" ADD CONSTRAINT "service_status_events_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "service_status_events_service_idx" ON "service_status_events" USING btree ("service_id");
  CREATE INDEX "service_status_events_changed_at_idx" ON "service_status_events" USING btree ("changed_at");
  CREATE INDEX "service_status_events_updated_at_idx" ON "service_status_events" USING btree ("updated_at");
  CREATE INDEX "service_status_events_created_at_idx" ON "service_status_events" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_service_status_events_fk" FOREIGN KEY ("service_status_events_id") REFERENCES "public"."service_status_events"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_service_status_events_id_idx" ON "payload_locked_documents_rels" USING btree ("service_status_events_id");

  -- Erster Protokolleintrag je bestehendem Dienst: ab jetzt ist der aktuelle Zustand bekannt.
  INSERT INTO "service_status_events" ("service_id", "status", "changed_at")
  SELECT "id", "status"::text::"enum_service_status_events_status", now() FROM "services";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_service_status_events_fk";
  DROP INDEX "payload_locked_documents_rels_service_status_events_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "service_status_events_id";
  DROP TABLE "service_status_events" CASCADE;
  ALTER TABLE "settings" DROP COLUMN "lagebild_variant";
  ALTER TABLE "service_groups" DROP COLUMN "icon";
  ALTER TABLE "incidents" DROP COLUMN "impact";
  DROP TYPE "public"."enum_settings_lagebild_variant";
  DROP TYPE "public"."enum_service_status_events_status";
  DROP TYPE "public"."enum_service_groups_icon";
  DROP TYPE "public"."enum_incidents_impact";`)
}
