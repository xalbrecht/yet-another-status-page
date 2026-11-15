# Sprachdateien, Schritt 3: Einstellung „Sprache“ und Sprache pro Anfrage

Stand 15.11.2026, Entwurf zur Freigabe. Gehört zu Issue #60 im Fork (GitHub), Meilenstein „Internationalisierung“. Baut auf Schritt 1 (PR #89) und Schritt 2 (PR #91) auf. Rahmen und Entscheidungen: `docs/superpowers/specs/2026-11-14-sprachdateien-design.md` (im Folgenden „Rahmenentwurf“). Dieses Dokument legt nur Schritt 3 fest.

## 1. Zweck

Der Betreiber wählt in den Website-Einstellungen die Sprache. Statusseite, E-Mails, SMS und Feeds richten sich danach, ebenso Datum und Uhrzeit. Heute gilt für den ganzen Prozess `DEFAULT_LANGUAGE`, gelesen beim Start. Eine neue Sprache (Datei im Verzeichnis `LOCALES_DIR`, Neustart) erscheint in der Auswahl, ohne Build und ohne weitere Migration.

## 2. Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**
- Neues Feld „Sprache“ in den Website-Einstellungen. Die Auswahlliste zeigt alle geladenen Sprachen mit `meta.name`.
- Jede Anfrage löst ihre Sprache aus der Einstellung auf. Eine Umstellung gilt ab der nächsten Anfrage, in jeder Instanz.
- Statusseite, E-Mails, SMS-Texte, Atom-Feed und iCal-Feed nutzen die gewählte Sprache.
- Datum und Uhrzeit nutzen `meta.dateLocale` der gewählten Sprache (Rahmenentwurf 4.4).
- Ist keine Sprache gewählt oder ist der Wert keine geladene Sprache mehr, gilt `DEFAULT_LANGUAGE`.

**Nicht-Ziele (kommen in Schritt 4 oder später)**
- Der Admin folgt der Einstellung nicht. Er bleibt bis Schritt 4 in der Sprache von `DEFAULT_LANGUAGE`. Die Auswahl trägt einen Hinweistext dazu.
- Weiche für das Cookie `payload-lng`, Ausblenden der Konto-Sprachwahl.
- `ta()` und die Beschriftungen von Collections und Globals.
- Handbuch und Änderungsprotokoll (Schritt 5).
- Trennung von Sprache und Datumsformat.

**Anti-Ziele**
- Eine zweite Datenbankabfrage je Anfrage, nur um die Sprache zu lesen.
- Ein Zwischenspeicher mit übersetztem Inhalt, dessen Schlüssel die Sprache nicht enthält (der Besucher sähe dann die Sprache des Vorgängers).
- Ein veränderlicher Wert im Prozess, den `t()` unsichtbar liest.
- Eine Sprache in der Einstellung, die nach dem Entfernen der Datei die Statusseite unbrauchbar macht.

## 3. Ausgangslage (geprüft am 15.11.2026)

- `src/lib/i18n/index.ts` exportiert `lang`, `t()` und `tf()` als Modulkonstanten aus `i18nState.language`. `src/lib/i18n/state.ts` hält `files` (alle geladenen Sprachen), `available` und baut das Wörterbuch nur für die eine Prozesssprache.
- `makeTranslators(dict)` in `core.ts` läuft ohne Dateizugriff, auch im Browser. `locales.ts` enthält `buildSiteDictionary(language, files, builtin)`.
- 22 Server-Dateien rufen `t()` oder `tf()` aus `@/lib/i18n` auf: `status-boxes.ts`, `lagebild-cache.ts`, `email.ts`, `feeds/ical.ts`, `feeds/atom.ts`, `api/notifications/send-from-collection/route.ts`, `api/subscribe/route.ts`, `not-found.tsx`, `(frontend)/layout.tsx`, `page.tsx`, `history/page.tsx`, `history/[date]/page.tsx`, `confirm/[token]/page.tsx`, `unsubscribe/[token]/page.tsx`, `i/[shortId]/page.tsx`, `m/[shortId]/page.tsx`, `(frontend)/not-found.tsx`, `tasks/sendNotificationFromCollection.ts`, `MaintenanceUpdatesTimeline.tsx`, `IncidentUpdatesTimeline.tsx`, `StatusBoxes.tsx`, `collections/Incidents.ts`, `collections/Maintenances.ts`. Mindestens `StatusBoxes.tsx` und die Zeitleisten sind Server-Komponenten ohne `"use client"`, das zeigt der Import. Der Umsetzer prüft jede Datei.
- Client-Komponenten bekommen ihr Wörterbuch über `I18nProvider` (`src/lib/i18n/client.tsx`). `(frontend)/layout.tsx` und `not-found.tsx` füllen ihn mit `getSiteDictionary()`.
- `getSettings()` in `src/lib/payload.ts` nutzt `cache()` von React und liest die Einstellungen einmal je Anfrage.
- Das Feld `locale` (Text, Standard `en-US`) steuert Datum und Uhrzeit über `resolveDateTimeConfig()` in `src/lib/datetime.ts`.
- Letzte Migration: `20261113_200000_add_status_box_settings.ts`.

## 4. Ansätze

| | A: Sprache als Parameter | C: Sprache als Wert im Prozess |
|---|---|---|
| Prinzip | Jeder Aufrufer holt `{ t, tf, lang }` per `await getTranslators()`. | Server hält die Sprache im Speicher, frischt sie alle 60 Sekunden auf. `t()` liest sie. |
| Eigenschaft | Jede Anfrage ist in sich richtig, Umstellung gilt sofort. Tests brauchen keinen globalen Zustand. | Aufrufer bleiben unverändert, aber veränderlicher Wert im Prozess, bis zu 60 Sekunden Unschärfe, bei mehreren Instanzen dauerhaft. |
| Aufwand | 22 Dateien ändern ihre Aufrufe. | Gering. |

**Gewählt: A** (entschieden von Frank Albrecht am 15.11.2026). C war als Kompromiss für einen kleineren Eingriff erwogen. Das Argument „Abstand zum Upstream“ trägt kaum: Die Aufrufe von `t()` existieren nur im Fork, die Signatur der Funktionen bleibt in beiden Wegen gleich.

## 5. Entwurf

### 5.1 `getTranslators()`

Neues Modul, nur für den Server (zum Beispiel `src/lib/i18n/server.ts`):

```ts
const { t, tf, lang, dateLocale } = await getTranslators()
```

- Liest die Einstellung über `getSettings()` (kein zweiter Abruf, `cache()` gilt je Anfrage).
- `resolveLanguage(value)`: Ist `value` in `i18nState.available`, gilt er. Sonst gilt `i18nState.language` (`DEFAULT_LANGUAGE`).
- Das Wörterbuch einer Sprache baut `buildSiteDictionary(language, files, builtin)` einmal und hält es in einer Tabelle nach Sprachcode. Die Dateien ändern sich bis zum Neustart nicht, der Speicher ist durch die Zahl der Sprachdateien begrenzt.
- `getTranslators(language?)` mit optionalem Wert für Stellen, die die Einstellungen schon haben (E-Mail-Versand, Aufgabe für Benachrichtigungen).
- `getSiteDictionary(language)` für den Kontext der Client-Komponenten.
- `dateLocale`: `meta.dateLocale` der Sprache, sonst abgeleitet aus dem Code (`de` → `de-DE`, `en` → `en-US`, `fr` → `fr-FR`). Die Ableitung existiert nach Rahmenentwurf 4.2 und wird hier umgesetzt, falls Schritt 2 sie noch nicht enthält.
- Fehler beim Lesen der Einstellungen (Datenbank nicht erreichbar): `DEFAULT_LANGUAGE`. Die 404-Seite darf nicht ausfallen, weil die Datenbank fehlt.

`lang`, `t`, `tf` und `getSiteDictionary` als Modulkonstanten aus `src/lib/i18n/index.ts` entfallen. Der Typ `TranslationKey` und `availableLanguages`/`localeProblems` bleiben.

### 5.2 Aufrufer

- **Seiten und Layouts (Server):** `const { t, tf } = await getTranslators()` am Anfang. `(frontend)/layout.tsx` wird dazu `async`, setzt `<html lang>` und `I18nProvider` aus der aufgelösten Sprache. `generateMetadata` in den Seiten liest Texte ebenso.
- **Server-Komponenten mit `t()` im Rumpf** (`StatusBoxes`, Zeitleisten, `MaintenanceCard`): entweder `async` mit `getTranslators()` oder `t`/`tf` als Eigenschaft von der Seite. Der Umsetzer wählt je Datei nach dem geringsten Eingriff. Client-Komponenten bleiben bei `useTranslation()`.
- **Module ohne React** (`status-boxes.ts`, `lagebild.ts`, `lagebild-cache.ts`, `email.ts`, `feeds/*`): `t` und `tf` kommen als Parameter. Gemeinsame Module, die auch im Browser laufen, importieren weder `@/lib/i18n` noch `@/lib/i18n/server`.
- **E-Mail, SMS, Benachrichtigungen** (`email.ts`, `tasks/sendNotificationFromCollection.ts`, die zwei API-Routen, die Hooks in `Incidents.ts` und `Maintenances.ts`): lesen die Sprache beim Versand aus den Einstellungen.
- **Feeds** (`feeds/atom.ts`, `feeds/ical.ts`, Routen `feed.atom`, `maintenances.ics`): `lang` im Feed folgt der Sprache.

### 5.3 Zwischenspeicher

Jeder Zwischenspeicher mit übersetztem Inhalt trägt die Sprache im Schlüssel. Der Umsetzer sucht sie mit `grep -rn "unstable_cache\|cache(" src`. Bekannt: `lagebildCacheKey(lang)` in `lagebild-cache.ts`. Er muss die aufgelöste Sprache der Anfrage erhalten statt der Modulkonstante. Die Seiten sind `force-dynamic`, der Rest ist je Anfrage.

### 5.4 Feld und Migration

- Neues Feld `language` (Typ `text`, nicht `select`) in `src/globals/Settings.ts`, im Reiter der Spracheinstellungen neben Zeitzone. Der Datenbankwert ist der Sprachcode (`fr`).
- Eine Migration legt die Spalte an (Muster der vorhandenen Migrationen, `20261115_…`). Standardwert in der Datenbank: leer. Ein leerer Wert bedeutet `DEFAULT_LANGUAGE`.
- Auswahlliste: kleine Feld-Komponente für den Admin, die aus `i18nState.available` und den `meta.name` die Liste baut. `validate` lehnt Werte ab, die keine geladene Sprache sind. Ein bereits gespeicherter Wert, der später nicht mehr geladen ist, gilt beim Auflösen als ungesetzt, blockiert aber das Speichern anderer Einstellungen nicht.
- **Zu prüfen (Rahmenentwurf 7, Punkt 1):** ob Payload ein Feld ohne Datenbank-Enum mit eigener Auswahl zulässt. Rückfall: Textfeld mit Hinweistext und `validate`.
- Hinweistext am Feld: „Der Admin folgt dieser Einstellung noch nicht.“ (entfällt mit Schritt 4).
- Das Feld `locale` bleibt in der Datenbank und wird im Admin ausgeblendet (Rahmenentwurf 8, Punkt 2). Es wird nicht mehr ausgewertet.

### 5.5 Datum und Uhrzeit

Heute lesen acht Stellen `resolveDateTimeConfig(settings)`, darunter Client-Komponenten im Admin, die die Einstellungen per `/api/globals/settings` holen. Damit keine dieser Stellen ihre Signatur ändert, bekommt `Settings` ein **virtuelles** Feld `dateLocale` (versteckt, nicht gespeichert, keine Migration). Ein `afterRead`-Hook füllt es mit der Datumssprache der aufgelösten Sprache. `resolveDateTimeConfig()` liest `settings.dateLocale` und fällt auf `settings.locale` zurück, wenn es fehlt. Aufrufer und Client-Komponenten bleiben unverändert.

### 5.6 SMS-Vorlagen

Die vier Standardtexte (`defaultValue` in `src/globals/SmsSettings.ts`) kommen nach Rahmenentwurf 8, Punkt 10 aus der Sprachdatei der beim ersten Speichern aktiven Sprache. **Zu prüfen:** ob Payload `defaultValue` als Funktion zulässt, die zur Anfragezeit läuft. Geht das nicht ohne großen Eingriff, entfällt dieser Punkt aus Schritt 3 und bekommt ein eigenes Issue. Bereits gespeicherte Betreibertexte bleiben unverändert.

## 6. Tests

- Einheitentests für `resolveLanguage`, `getTranslators` (Rückfall bei ungültigem Wert, bei fehlender Einstellung) und die Ableitung von `dateLocale`.
- E2E (Playwright): Statusseite mit Einstellung `de` und `en`, beide mit derselben Seite und denselben Elementen, Datum in der Sprache (`de`: 24 Stunden). Eine Testsprache mit wenigen Einträgen in einem temporären `LOCALES_DIR` (zum Beispiel `fr.json` mit drei Texten): erscheint in der Auswahl, nicht übersetzte Texte auf Englisch.
- Eine entfernte Sprache in der Einstellung: Statusseite läuft mit `DEFAULT_LANGUAGE`.
- Zwischenspeicher: Seite in `de` laden, auf `en` umstellen, nächste Anfrage zeigt Englisch.
- `docker-compose.test.yml` setzt `DEFAULT_LANGUAGE` statt `NEXT_PUBLIC_UI_LANG`, falls noch nicht geschehen. Die E2E-Suite bleibt mit einem Worker (Lehre aus Issue #92).
- Bestehende Suite (153 Tests) bleibt grün. Ein gebauter Server (`next build`, `standalone`) wird zusätzlich geprüft, weil Hydrierungsfehler nur dort und in der Browserkonsole sichtbar sind.

## 7. Lieferung

Ein Issue, ein Pull Request, eine Migration. Atomare Commits in dieser Reihenfolge: (1) `getTranslators()` mit Tests, (2) Feld, Migration und Auswahl, (3) Aufrufer Statusseite, (4) Aufrufer E-Mail, SMS, Feeds, (5) Datum, (6) Tests. Nach dem Merge ein Image und Prüfung auf Dev.

Im Pull Request unter „Nicht Teil dieses PR“: Admin folgt der Einstellung (Schritt 4, Issue anlegen), Handbuch und Änderungsprotokoll (Schritt 5), Issue #90 (Maskierung der Übersetzungen in E-Mail, Atom und iCal).

## 8. Eigene Festlegungen des Verfassers

1. `getTranslators()` liegt in einem eigenen Server-Modul, `index.ts` behält Typ und Listen.
2. Wörterbuch je Sprache einmal gebaut und im Speicher gehalten.
3. Rückfall bei Datenbankfehler und bei ungültigem Wert ist `DEFAULT_LANGUAGE`, kein Fehler.
4. Hinweistext am Feld bis Schritt 4.
5. Der Punkt SMS-Standardtexte entfällt aus Schritt 3, wenn er sich nicht ohne großen Eingriff umsetzen lässt.
6. Reihenfolge der Commits wie in Abschnitt 7.
7. Datum über ein virtuelles Feld `dateLocale` statt eines Parameters (Abschnitt 5.5): weniger geänderte Aufrufer, die Admin-Komponenten erhalten den Wert über die vorhandene Abfrage.
