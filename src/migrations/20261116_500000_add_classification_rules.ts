import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Regeln für die automatische Einordnung alter Vorfälle (Einstellungen, Feld classificationRules).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_settings_classification_rules_field" AS ENUM('title', 'updates');
  CREATE TYPE "public"."enum_settings_classification_rules_match" AS ENUM('contains', 'starts');
  CREATE TYPE "public"."enum_settings_classification_rules_classification" AS ENUM('maintenance', 'none', 'degraded', 'partial', 'major');
  CREATE TABLE "settings_classification_rules" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"field" "enum_settings_classification_rules_field" DEFAULT 'title' NOT NULL,
  	"match" "enum_settings_classification_rules_match" DEFAULT 'contains' NOT NULL,
  	"classification" "enum_settings_classification_rules_classification" DEFAULT 'partial' NOT NULL,
  	"words" varchar NOT NULL
  );
  ALTER TABLE "settings_classification_rules" ADD CONSTRAINT "settings_classification_rules_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "settings_classification_rules_order_idx" ON "settings_classification_rules" USING btree ("_order");
  CREATE INDEX "settings_classification_rules_parent_id_idx" ON "settings_classification_rules" USING btree ("_parent_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "settings_classification_rules" CASCADE;
  DROP TYPE "public"."enum_settings_classification_rules_field";
  DROP TYPE "public"."enum_settings_classification_rules_match";
  DROP TYPE "public"."enum_settings_classification_rules_classification";`)
}
