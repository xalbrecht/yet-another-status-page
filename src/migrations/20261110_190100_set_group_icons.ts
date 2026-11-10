import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Vorbelegung der Gruppen-Icons nach Gruppenname. Nur Gruppen, die noch das Standard-Icon
// tragen, werden geändert. Bereits im Admin gewählte Icons und unbekannte Namen bleiben.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   UPDATE "service_groups" AS g
  SET "icon" = m."icon"::"public"."enum_service_groups_icon"
  FROM (VALUES
    ('Applikationsservices', 'AppWindow'),
    ('Arbeitsplatz', 'Monitor'),
    ('Ausländerwesen', 'Languages'),
    ('Bauaufsicht', 'ClipboardCheck'),
    ('Bauen', 'HardHat'),
    ('Bildung', 'GraduationCap'),
    ('Buß- und Verwarngeld', 'Receipt'),
    ('Digitalisierungsberatung', 'Lightbulb'),
    ('Einwohnerwesen', 'Users'),
    ('Facilitymanagement', 'Wrench'),
    ('Fahrerlaubnis', 'IdCard'),
    ('Freizeit', 'Trees'),
    ('Friedhof', 'Flower2'),
    ('Geoinformationssysteme', 'Map'),
    ('Gewerbe', 'Store'),
    ('Haushalt und Finanzen', 'Euro'),
    ('IT-Sicherheit und Datenschutz', 'ShieldCheck'),
    ('iWAN', 'Waypoints'),
    ('KFZ-Zulassung', 'Car'),
    ('Kinder und Jugend', 'Baby'),
    ('Kommunikation', 'Mail'),
    ('Liegenschaften', 'Building2'),
    ('Netzwerk', 'Network'),
    ('Personenstandswesen', 'Heart'),
    ('Portal- und Webservices', 'Globe'),
    ('Rechenzentrum', 'Server'),
    ('Schriftgutmanagement', 'FolderOpen'),
    ('Schul-IT', 'School'),
    ('Schulträger', 'BookOpen'),
    ('Sitzungsdienst', 'Presentation'),
    ('Sozialhilfe', 'HeartHandshake'),
    ('Umwelt', 'Leaf'),
    ('Veranstaltungen', 'CalendarDays'),
    ('Webseiten', 'LayoutTemplate'),
    ('Wohngeld', 'House'),
    ('Zentrale Services', 'Landmark')
  ) AS m("name", "icon")
  WHERE g."name" = m."name" AND g."icon" = 'LayoutGrid';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Die Vorbelegung lässt sich nicht von Hand gewählten Icons unterscheiden. Es bleibt beim Ist-Stand.
}
