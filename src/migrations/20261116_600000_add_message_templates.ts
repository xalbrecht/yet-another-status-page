import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Vorlagen für Meldungen (Collection message-templates): Titel und Texte je Art und Aktualisierungsstatus.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_message_templates_kind" AS ENUM('incident', 'maintenance');
  CREATE TYPE "public"."enum_message_templates_status" AS ENUM('investigating', 'identified', 'monitoring', 'resolved', 'upcoming', 'in_progress', 'completed', 'cancelled');
  CREATE TYPE "public"."enum_message_templates_impact" AS ENUM('degraded', 'partial', 'major');
  CREATE TABLE "message_templates" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"kind" "enum_message_templates_kind" DEFAULT 'incident' NOT NULL,
  	"status" "enum_message_templates_status" NOT NULL,
  	"impact" "enum_message_templates_impact",
  	"title" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"sms_body" varchar,
  	"ntfy_body" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "message_templates_id" integer;
  CREATE INDEX "message_templates_updated_at_idx" ON "message_templates" USING btree ("updated_at");
  CREATE INDEX "message_templates_created_at_idx" ON "message_templates" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_message_templates_fk" FOREIGN KEY ("message_templates_id") REFERENCES "public"."message_templates"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_message_templates_id_idx" ON "payload_locked_documents_rels" USING btree ("message_templates_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_message_templates_fk";
  DROP INDEX "payload_locked_documents_rels_message_templates_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "message_templates_id";
  DROP TABLE "message_templates" CASCADE;
  DROP TYPE "public"."enum_message_templates_kind";
  DROP TYPE "public"."enum_message_templates_status";
  DROP TYPE "public"."enum_message_templates_impact";`)
}
