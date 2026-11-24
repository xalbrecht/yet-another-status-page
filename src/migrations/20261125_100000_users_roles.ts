import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Rollen der Benutzer (Issue #259): statt einer Rolle (role) eine Liste (roles) und je Rolle der Haken „alle Dienstgruppen“
// oder eine Auswahl von Dienstgruppen. Aus admin wird admin, aus editor wird servicedesk mit „alle Dienstgruppen“,
// damit der Zugriff bestehender Redakteure gleich bleibt.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_roles" AS ENUM('admin', 'servicedesk', 'produktmanager');
  CREATE TABLE "users_roles" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_users_roles",
  	"id" serial PRIMARY KEY NOT NULL
  );

  CREATE TABLE "users_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"service_groups_id" integer
  );

  ALTER TABLE "users" ADD COLUMN "servicedesk_alle_gruppen" boolean DEFAULT false;
  ALTER TABLE "users" ADD COLUMN "produktmanager_alle_gruppen" boolean DEFAULT false;

  INSERT INTO "users_roles" ("order", "parent_id", "value")
    SELECT 1, "id", CASE "role"::text WHEN 'admin' THEN 'admin' ELSE 'servicedesk' END::"enum_users_roles" FROM "users";
  UPDATE "users" SET "servicedesk_alle_gruppen" = true WHERE "role"::text = 'editor';

  ALTER TABLE "users" DROP COLUMN "role";
  DROP TYPE "public"."enum_users_role";

  ALTER TABLE "users_roles" ADD CONSTRAINT "users_roles_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_service_groups_fk" FOREIGN KEY ("service_groups_id") REFERENCES "public"."service_groups"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_roles_order_idx" ON "users_roles" USING btree ("order");
  CREATE INDEX "users_roles_parent_idx" ON "users_roles" USING btree ("parent_id");
  CREATE INDEX "users_rels_order_idx" ON "users_rels" USING btree ("order");
  CREATE INDEX "users_rels_parent_idx" ON "users_rels" USING btree ("parent_id");
  CREATE INDEX "users_rels_path_idx" ON "users_rels" USING btree ("path");
  CREATE INDEX "users_rels_service_groups_id_idx" ON "users_rels" USING btree ("service_groups_id");`)
}

// Die Gruppenauswahl geht verloren. Wer Admin ist, bleibt admin, alle übrigen werden editor (neu angelegte ohne Rolle auch).
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'editor');
  ALTER TABLE "users" ADD COLUMN "role" "enum_users_role" DEFAULT 'editor' NOT NULL;
  UPDATE "users" SET "role" = 'admin' WHERE "id" IN (SELECT "parent_id" FROM "users_roles" WHERE "value" = 'admin');

  DROP TABLE "users_roles" CASCADE;
  DROP TABLE "users_rels" CASCADE;
  ALTER TABLE "users" DROP COLUMN "servicedesk_alle_gruppen";
  ALTER TABLE "users" DROP COLUMN "produktmanager_alle_gruppen";
  DROP TYPE "public"."enum_users_roles";`)
}
