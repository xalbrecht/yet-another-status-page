import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Die Standardtexte der SMS-Vorlagen kommen aus der Sprachdatei (Schlüssel notif.sms*). Leer gilt der Standardtext
// der Sprache. Die englischen Standardwerte der Spalten entfallen, und Werte, die genau dem alten Standard
// entsprechen, werden geleert (sie stammen nie vom Betreiber). Eigene Texte bleiben unverändert.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "sms_settings" ALTER COLUMN "template_incident_new" DROP DEFAULT;
   ALTER TABLE "sms_settings" ALTER COLUMN "template_incident_update" DROP DEFAULT;
   ALTER TABLE "sms_settings" ALTER COLUMN "template_maintenance_new" DROP DEFAULT;
   ALTER TABLE "sms_settings" ALTER COLUMN "template_maintenance_update" DROP DEFAULT;
   UPDATE "sms_settings" SET "template_incident_new" = NULL WHERE "template_incident_new" = '[{{siteName}}] 🚨 INCIDENT: {{title}} | {{status}} | {{message}} | {{url}}';
   UPDATE "sms_settings" SET "template_incident_update" = NULL WHERE "template_incident_update" = '[{{siteName}}] 📢 {{title}} | {{status}} | {{message}} | {{url}}';
   UPDATE "sms_settings" SET "template_maintenance_new" = NULL WHERE "template_maintenance_new" = '[{{siteName}}] 🔧 MAINTENANCE: {{title}} | {{schedule}} | {{url}}';
   UPDATE "sms_settings" SET "template_maintenance_update" = NULL WHERE "template_maintenance_update" = '[{{siteName}}] 🔧 {{title}} | {{status}} | {{schedule}} | {{message}} | {{url}}';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "sms_settings" ALTER COLUMN "template_incident_new" SET DEFAULT '[{{siteName}}] 🚨 INCIDENT: {{title}} | {{status}} | {{message}} | {{url}}';
   ALTER TABLE "sms_settings" ALTER COLUMN "template_incident_update" SET DEFAULT '[{{siteName}}] 📢 {{title}} | {{status}} | {{message}} | {{url}}';
   ALTER TABLE "sms_settings" ALTER COLUMN "template_maintenance_new" SET DEFAULT '[{{siteName}}] 🔧 MAINTENANCE: {{title}} | {{schedule}} | {{url}}';
   ALTER TABLE "sms_settings" ALTER COLUMN "template_maintenance_update" SET DEFAULT '[{{siteName}}] 🔧 {{title}} | {{status}} | {{schedule}} | {{message}} | {{url}}';
   UPDATE "sms_settings" SET "template_incident_new" = '[{{siteName}}] 🚨 INCIDENT: {{title}} | {{status}} | {{message}} | {{url}}' WHERE "template_incident_new" IS NULL;
   UPDATE "sms_settings" SET "template_incident_update" = '[{{siteName}}] 📢 {{title}} | {{status}} | {{message}} | {{url}}' WHERE "template_incident_update" IS NULL;
   UPDATE "sms_settings" SET "template_maintenance_new" = '[{{siteName}}] 🔧 MAINTENANCE: {{title}} | {{schedule}} | {{url}}' WHERE "template_maintenance_new" IS NULL;
   UPDATE "sms_settings" SET "template_maintenance_update" = '[{{siteName}}] 🔧 {{title}} | {{status}} | {{schedule}} | {{message}} | {{url}}' WHERE "template_maintenance_update" IS NULL;`)
}
