# Sprachdateien Schritt 3: Einstellung „Sprache“ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Betreiber wählt die Sprache in den Website-Einstellungen. Statusseite, E-Mail, SMS, Feeds sowie Datum und Uhrzeit folgen ihr pro Anfrage.

**Architecture:** Ein Server-Modul `getTranslators()` löst die Sprache aus `getSettings()` auf (Ansatz A: Sprache als Parameter, kein Wert im Prozess). Reine Logik (Auflösen, Datumssprache) steht in `locales.ts` und ist ohne Payload testbar. Das Feld `language` ist ein Textfeld mit eigener Auswahl-Komponente. Ein virtuelles Feld `dateLocale` trägt die Datumssprache zu allen Stellen, die `resolveDateTimeConfig()` aufrufen.

**Tech Stack:** Next.js (Fork-Version, vor dem Schreiben `node_modules/next/dist/docs/` lesen, siehe `AGENTS.md`), Payload 3.90.2, PostgreSQL-Migrationen, `tsx --test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-15-sprachdateien-einstellung-design.md` (Schritt 3), Rahmen `docs/superpowers/specs/2026-11-14-sprachdateien-design.md`. Issue #94 im Fork (GitHub).

## Global Constraints

- Neue Sprachen entstehen durch eine Datei in `LOCALES_DIR` und einen Neustart, ohne Build und ohne weitere Migration.
- Ein leerer oder unbekannter Wert in `language` bedeutet `DEFAULT_LANGUAGE` (`i18nState.language`), nie einen Fehler.
- Der Admin bleibt in Schritt 3 in der Sprache von `DEFAULT_LANGUAGE`. Das Feld trägt dazu einen Hinweistext (entfällt mit Schritt 4).
- Das Feld `locale` bleibt in der Datenbank, wird im Admin ausgeblendet und nur noch als Rückfall gelesen.
- Gemeinsame Module und Client-Komponenten importieren weder `@/lib/i18n` noch `@/lib/i18n/server` (Dateizugriff bricht den Client-Build). Texte kommen über `useTranslation()` oder als Parameter `t`/`tf`.
- Jeder Zwischenspeicher mit übersetztem Inhalt trägt die Sprache im Schlüssel.
- Fork ist öffentlich: in Dateien, Commits und Texten keine internen Namen, Hosts oder Pfade.
- Commit-Format `<typ>(<scope>): <beschreibung> (#94)`, Imperativ, erste Zeile ≤ 50 Zeichen. Nie auf `main`.

## Review Focus

- Die gespeicherte Sprache ist nach dem Entfernen der Datei nicht mehr geladen: Statusseite läuft mit `DEFAULT_LANGUAGE` (Task 1, Task 3).
- Die Datenbank ist beim Auflösen der Sprache nicht erreichbar: 404-Seite und Layout rendern mit `DEFAULT_LANGUAGE` (Task 1).
- Umstellung de → en: die nächste Anfrage zeigt Englisch trotz Zwischenspeicher des Lagebilds (Task 4).
- E-Mail und SMS in der gewählten Sprache, nicht in der des Prozesses (Task 5).
- Eine Sprache ohne `meta.dateLocale` (Datei nennt nur `meta.name`): Datum nutzt die aus dem Code abgeleitete Schreibweise (Task 1, Task 2).

---

## Dateiübersicht

| Datei | Änderung |
|---|---|
| `src/lib/i18n/locales.ts` | `resolveLanguage()`, `deriveDateLocale()` (rein) |
| `src/lib/i18n/server.ts` | neu: `getTranslators()`, `translatorsFor()`, `translatorsForSettings()`, `languageOptions()` |
| `src/lib/i18n/index.ts` | am Ende: `lang`, `t`, `tf`, `getSiteDictionary` entfernen |
| `src/globals/Settings.ts` | Feld `language`, virtuelles Feld `dateLocale`, `locale` ausblenden |
| `src/components/admin/LanguageField.tsx` | neu: Auswahl-Komponente |
| `src/migrations/20261115_100000_add_settings_language.ts` | neu, `src/migrations/index.ts` ergänzen |
| `src/lib/datetime.ts` | `resolveDateTimeConfig` liest `dateLocale` |
| Aufrufer der 22 Dateien | siehe Task 3 bis 5 |
| `tests/unit/`, `tests/e2e/language-setting.spec.ts` | neue Tests |

---

### Task 1: Auflösen der Sprache und `getTranslators()`

**Files:**
- Modify: `src/lib/i18n/locales.ts`
- Create: `src/lib/i18n/server.ts`
- Test: `tests/unit/i18n-resolve.test.ts`

**Interfaces:**
- Produces in `locales.ts`:
  - `resolveLanguage(value: string | null | undefined, available: readonly string[], fallback: string): string` – `value`, wenn in `available`, sonst `fallback`.
  - `deriveDateLocale(code: string, meta?: { dateLocale?: string }): string` – `meta.dateLocale`, sonst Tabelle `de→de-DE`, `en→en-US`, `fr→fr-FR`, `es→es-ES`, `it→it-IT`, `pl→pl-PL`, `tr→tr-TR`, sonst der Code selbst (`Intl` akzeptiert ihn).
- Produces in `server.ts`:
  - `translatorsFor(language: string): { t: Translate; tf: TranslateFormat; lang: string; dateLocale: string; dictionary: Record<string, string> }` – synchron, Wörterbuch je Sprache einmal mit `buildSiteDictionary(language, i18nState.files, builtin)` gebaut und in einer `Map` gehalten.
  - `translatorsForSettings(settings: { language?: string | null } | null | undefined)` – wie `translatorsFor(resolveLanguage(...))`.
  - `getTranslators(): Promise<ReturnType<typeof translatorsFor>>` – liest `getSettings()` (`src/lib/payload.ts`), fängt jeden Fehler ab und nimmt dann `DEFAULT_LANGUAGE`.
  - `languageOptions(): { code: string; name: string }[]` – aus `i18nState.available` und `meta.name` (eingebaute Fassungen liefern `meta.name` aus `deJson`/`enJson`).

- [ ] **Step 1: Write the failing tests** in `tests/unit/i18n-resolve.test.ts`: `resolveLanguage('fr', ['de','en','fr'], 'de') === 'fr'`; `resolveLanguage('xx', [...], 'de') === 'de'`; `resolveLanguage('', ...)`, `null`, `undefined` ergeben `'de'`; `deriveDateLocale('de') === 'de-DE'`; `deriveDateLocale('fr', { dateLocale: 'fr-CH' }) === 'fr-CH'`; `deriveDateLocale('nl') === 'nl'`.
- [ ] **Step 2: Run** `npx tsx --test tests/unit/i18n-resolve.test.ts`. Expected: FAIL (Funktionen fehlen).
- [ ] **Step 3: Implement** beide Funktionen in `locales.ts` (rein, ohne Dateizugriff).
- [ ] **Step 4: Run** den Test. Expected: PASS.
- [ ] **Step 5: Implement `server.ts`** mit den vier Funktionen. Beginnt mit `import 'server-only'` falls das Paket im Projekt vorhanden ist, sonst ohne. `getTranslators()` muss bei geworfenem `getSettings()` die Prozesssprache liefern.
- [ ] **Step 6: Write test** `getTranslators` Rückfall: `translatorsForSettings({ language: 'zz' }).lang === i18nState.language` und `translatorsForSettings(null).lang === i18nState.language` (in derselben Testdatei, mit `import { translatorsForSettings } from '../../src/lib/i18n/server'`; falls der Import wegen Payload-Abhängigkeit im Test scheitert, `getSettings` nur in `getTranslators()` importieren, nicht auf Modulebene).
- [ ] **Step 7: Run** `npm run test:unit && npm run typecheck`. Expected: PASS.
- [ ] **Step 8: Commit** `feat(i18n): Löse die Sprache pro Anfrage auf (#94)`.

---

### Task 2: Feld, Migration, Auswahl, Datumssprache

**Files:**
- Modify: `src/globals/Settings.ts` (Abschnitt „Localization“, nach `timezone`), `src/lib/datetime.ts:92-103`, `src/migrations/index.ts`, `src/payload-types.ts` (neu erzeugt)
- Create: `src/migrations/20261115_100000_add_settings_language.ts`, `src/components/admin/LanguageField.tsx`
- Test: `tests/unit/datetime-locale.test.ts`

**Interfaces:**
- Consumes: `resolveLanguage`, `deriveDateLocale`, `languageOptions()` aus Task 1.
- Produces: `Setting.language?: string | null`, `Setting.dateLocale?: string | null` (virtuell, nur lesen), `resolveDateTimeConfig(settings)` nutzt `settings.dateLocale || settings.locale || DEFAULT_LOCALE`.

- [ ] **Step 1: Write the failing test** `tests/unit/datetime-locale.test.ts`: `resolveDateTimeConfig({ dateLocale: 'de-DE', locale: 'en-US' }).locale === 'de-DE'`; ohne `dateLocale` gilt `locale`; ohne beides `'en-US'`.
- [ ] **Step 2: Run**, Expected: FAIL.
- [ ] **Step 3: Implement** die Änderung in `resolveDateTimeConfig` (Typ der Eingabe um `dateLocale?: string | null` erweitern).
- [ ] **Step 4: Run**, Expected: PASS.
- [ ] **Step 5: Prüfen** (Rahmenentwurf 7, Punkt 1) in `node_modules/payload` und der Payload-Dokumentation, ob ein Feld mit Typ `text` und `admin.components.Field` eine eigene Auswahl rendern kann. Das ist der Plan. Rückfall bei Problemen: Textfeld mit Hinweistext und `validate`. Ergebnis im Commit-Text nennen.
- [ ] **Step 6: Implement Feld `language`** in `Settings.ts`: `type: 'text'`, `label: ta('Language')`, `admin.components.Field: '@/components/admin/LanguageField#LanguageField'`, `admin.description` mit dem Hinweis, dass der Admin der Einstellung noch nicht folgt, `validate`: leer ist erlaubt, sonst muss der Wert in `languageOptions()` stehen, Meldung nennt die erlaubten Codes. `ta()`-Texte in `locales/de.json` unter `admin` ergänzen (`Language`, Beschreibung) und `npm run check:locales` ausführen.
- [ ] **Step 7: Implement `LanguageField.tsx`** (Client-Komponente, Muster `LocalizedDateField.tsx`): `useField<string>({ path })`, Auswahl aus einer Liste, die der Server als Eigenschaft liefert (`clientProps` am Feld, Werte aus `languageOptions()`), leere Auswahl heißt „Standard (`DEFAULT_LANGUAGE`)“ mit dem Namen der Standardsprache. Importiert `@/lib/i18n/server` nicht.
- [ ] **Step 8: Virtuelles Feld `dateLocale`** in `Settings.ts`: `type: 'text'`, `virtual: true`, `admin: { hidden: true, disableBulkEdit: true }`, `hooks.afterRead: [({ siblingData }) => translatorsForSettings(siblingData).dateLocale]`. Feld `locale` bekommt `admin.hidden: true` (Rahmenentwurf 8, Punkt 2).
- [ ] **Step 9: Migration** `20261115_100000_add_settings_language.ts`: `ALTER TABLE "settings" ADD COLUMN "language" varchar;` in `up`, `DROP COLUMN` in `down`. In `src/migrations/index.ts` eintragen (Muster der vorhandenen Einträge). Danach `npm run generate:types` bzw. der im Repo vorhandene Befehl aus `package.json`.
- [ ] **Step 10: Run** `npm run typecheck && npm run lint && npm run test:unit`. Expected: PASS.
- [ ] **Step 11: Commit** `feat(settings): Füge das Feld Sprache hinzu (#94)`.

---

### Task 3: Statusseite, Layouts, Fehlerseiten

**Files:**
- Modify: `src/app/(frontend)/layout.tsx`, `src/app/not-found.tsx`, `src/app/(frontend)/not-found.tsx`, `src/app/(frontend)/page.tsx`, `src/app/(frontend)/history/page.tsx`, `src/app/(frontend)/history/[date]/page.tsx`, `src/app/(frontend)/i/[shortId]/page.tsx`, `src/app/(frontend)/m/[shortId]/page.tsx`, `src/app/(frontend)/confirm/[token]/page.tsx`, `src/app/(frontend)/unsubscribe/[token]/page.tsx`

**Interfaces:**
- Consumes: `getTranslators()` aus Task 1 (liefert `t`, `tf`, `lang`, `dictionary`).
- Produces: Seiten holen `const { t, tf, lang } = await getTranslators()` am Anfang; `generateMetadata` ebenso. `FrontendLayout` wird `async`, setzt `<html lang={lang}>` und `<I18nProvider dictionary={dictionary}>`. Die alten Modulkonstanten bleiben in diesem Task bestehen (Task 6 entfernt sie).

- [ ] **Step 1: Write the failing E2E test** `tests/e2e/language-setting.spec.ts`, Fall 1: Einstellung `language: 'en'` per API setzen (Muster aus `tests/e2e/status-page.spec.ts`), Startseite zeigt einen englischen Text aus `locales/en.json` (`site`-Block, zum Beispiel den Text zu `status.operational`) und `<html lang="en">`; mit `language: 'de'` den deutschen Text und `lang="de"`. Zurücksetzen in `afterAll`.
- [ ] **Step 2: Run** `CI= PAYLOAD_PUBLIC_ALLOW_WRITES=true npx playwright test tests/e2e/language-setting.spec.ts --project=chromium --workers=1` (Umgebung: `tests/README.md`, `reference_e2e-umgebung`). Expected: FAIL.
- [ ] **Step 3: Implement** die Umstellung der zehn Dateien. Server-Komponenten, die `t()` im Rumpf nutzen und nicht `async` sind (`StatusBoxes`, Zeitleisten), kommen in Task 4.
- [ ] **Step 4: Fall 2 ergänzen**: Einstellung `language: 'xx'` ist über die API nicht speicherbar (`validate`), daher Rückfall prüfen als Einheitentest in Task 1 (bereits abgedeckt). Hier stattdessen: leere Sprache zeigt den Text der Prozesssprache.
- [ ] **Step 5: Run** den E2E-Test und `npm run typecheck`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(i18n): Nutze die Sprache der Einstellung auf der Statusseite (#94)`.

---

### Task 4: Komponenten, Module ohne React, Zwischenspeicher

**Files:**
- Modify: `src/components/status/StatusBoxes.tsx`, `MaintenanceUpdatesTimeline.tsx`, `IncidentUpdatesTimeline.tsx`, `MaintenanceCard.tsx` (nur Typ-Import prüfen), `src/lib/status-boxes.ts`, `src/lib/lagebild-cache.ts`, `src/lib/lagebild.ts` (Aufruferseite)
- Test: `tests/unit/lagebild-cache-key.test.ts` (erweitern)

**Interfaces:**
- Consumes: `translatorsFor(language)` aus Task 1.
- Produces: `loadLagebildCached(dt, periodDays?, barHours?, language?)` – `language` ist ein einfacher Wert und Teil der Argumente des `unstable_cache` (damit Teil des Schlüssels). Innerhalb der Funktion baut `translatorsFor(language)` die `{ t, tf }`. `status-boxes.ts` bekommt `t`, `tf` als Parameter (`buildStatusBoxes(..., { t, tf })` – Form wie `loadLagebild` sie schon nimmt).

- [ ] **Step 1: Write the failing test** in `lagebild-cache-key.test.ts`: `loadLagebildCached` ist nicht ohne Datenbank testbar, daher Test auf `status-boxes.ts`: ein Aufruf mit englischen und ein Aufruf mit deutschen `t`/`tf` ergeben unterschiedliche `stateLabel` (Fixtur wie in vorhandenen Tests für `status-boxes`, falls vorhanden, sonst minimal).
- [ ] **Step 2: Run**, Expected: FAIL.
- [ ] **Step 3: Implement** die Parameter in `status-boxes.ts` und `lagebild-cache.ts`. Die Seiten (Task 3) reichen `lang` und `{ t, tf }` durch; `page.tsx` ruft `loadLagebildCached(dt, days, hours, lang)`.
- [ ] **Step 4: Implement** `StatusBoxes.tsx` und die Zeitleisten: `t`/`tf` als Eigenschaft von der Seite, oder `async` mit `getTranslators()`. Je Datei die kleinere Änderung.
- [ ] **Step 5: E2E-Fall 3 ergänzen** (Zwischenspeicher): Seite mit `de` laden, Einstellung auf `en` ändern, `page.reload()` zeigt Englisch im Lagebild (nicht erst nach `LAGEBILD_CACHE_SECONDS`).
- [ ] **Step 6: Run** `npm run test:unit && npm run typecheck`, danach den E2E-Test. Expected: PASS.
- [ ] **Step 7: Commit** `feat(i18n): Trage die Sprache in den Zwischenspeicher ein (#94)`.

---

### Task 5: E-Mail, SMS, Feeds, Benachrichtigungen

**Files:**
- Modify: `src/lib/email.ts`, `src/lib/feeds/atom.ts`, `src/lib/feeds/ical.ts`, `src/app/feed.atom/route.ts`, `src/app/maintenances.ics/route.ts`, `src/app/api/notifications/send-from-collection/route.ts`, `src/app/api/subscribe/route.ts`, `src/tasks/sendNotificationFromCollection.ts`, `src/collections/Incidents.ts`, `src/collections/Maintenances.ts`

**Interfaces:**
- Consumes: `translatorsFor`, `translatorsForSettings`, `getTranslators` aus Task 1.
- Produces: `email.ts`-Funktionen nehmen `{ t, tf, lang }` als Parameter oder einen Parameter `language: string`; der Aufrufer löst sie aus den Einstellungen auf, die er an der Stelle schon hat. Atom und iCal nehmen `t`/`tf` als Parameter; die Routen rufen `getTranslators()`. Die Hooks in `Incidents.ts` und `Maintenances.ts` rufen `translatorsForSettings(settings)` mit den Einstellungen, die sie bereits laden.

- [ ] **Step 1: Write the failing test** in `tests/unit/email-language.test.ts`: Die E-Mail-HTML-Funktion (Name aus `email.ts`, die `<html lang="…">` erzeugt) liefert mit `lang: 'en'` den englischen Text und `lang="en"`, mit `lang: 'de'` Deutsch.
- [ ] **Step 2: Run**, Expected: FAIL.
- [ ] **Step 3: Implement** die Parameter in `email.ts` und stelle alle Aufrufer um (die `grep -rn "from '@/lib/email'" src` nennt sie).
- [ ] **Step 4: Implement** Feeds und Routen; `lang` im Feed folgt der Sprache.
- [ ] **Step 5: Implement** Aufgabe und Routen für Benachrichtigungen sowie die Hooks in `Incidents.ts`/`Maintenances.ts`. Die SMS-Standardtexte (`SmsSettings.ts`, `defaultValue`) bleiben in Schritt 3 unverändert, wenn Payload `defaultValue` nicht als Funktion zur Anfragezeit ausführt (Prüfen: Dokumentation in `node_modules/payload`). Kann man es sauber tun, übernimmt `defaultValue` die Texte der aktiven Sprache; sonst im PR unter „Nicht Teil“ mit eigenem Issue.
- [ ] **Step 6: E2E-Fall 4**: Mit `language: 'en'` liefert `GET /feed.atom` einen englischen Text und `xml:lang="en"` (Attribut je nach `atom.ts`), mit `de` Deutsch; ebenso `GET /maintenances.ics` für einen übersetzten Text.
- [ ] **Step 7: Run** `npm run test:unit && npm run typecheck`, E2E-Test. Expected: PASS.
- [ ] **Step 8: Commit** `feat(i18n): Nutze die Sprache in Mails und Feeds (#94)`.

---

### Task 6: Modulkonstanten entfernen, Testsprache, Gesamtprüfung

**Files:**
- Modify: `src/lib/i18n/index.ts`, `docker-compose.test.yml` (nur prüfen), `src/payload.config.ts:48` (importiert `lang` aus `@/lib/i18n`)
- Test: `tests/e2e/language-setting.spec.ts` (Fall 5), `tests/unit/i18n-init.test.ts` (unverändert grün)

**Interfaces:**
- Consumes: alle vorherigen Tasks.
- Produces: `src/lib/i18n/index.ts` exportiert nur noch Typ `TranslationKey`, `availableLanguages`, `localeProblems`. `payload.config.ts` nimmt `i18nState.language` (Admin-Sprache bleibt die der Prozesssprache bis Schritt 4).

- [ ] **Step 1: Entfernen** von `lang`, `t`, `tf`, `getSiteDictionary` aus `index.ts` und `payload.config.ts` auf `i18nState.language` umstellen. `npm run typecheck` nennt jede übersehene Stelle (jeder Fehler ist ein Aufrufer, den Tasks 3 bis 5 nicht erfassten).
- [ ] **Step 2: E2E-Fall 5** (Testsprache): temporäres `LOCALES_DIR` mit `fr.json` (`meta.name` „Français“, drei Texte in `site`) in der Testumgebung (`docker-compose.test-ca.yml`-Muster, Volume). Auswahl im Admin enthält „Français“; Einstellung `fr`: übersetzte Texte französisch, übrige englisch. Falls die Testumgebung kein zweites Volume zulässt, den Fall als Einheitentest auf `translatorsFor('fr')` mit `initI18n` und einem Temp-Verzeichnis schreiben (Muster `i18n-init.test.ts`) und im PR vermerken.
- [ ] **Step 3: Gesamtprüfung** `npm run lint && npm run typecheck && npm run test:unit && npm run check:locales` und die vollständige E2E-Suite (`npm run test:e2e`, ein Worker, frische Datenbank wie in `reference_e2e-umgebung`). Expected: alles grün, 153 oder mehr Tests bestanden.
- [ ] **Step 4: Gebauter Server** (`npm run build` und `node .next/standalone/server.js` gegen die Testdatenbank): Startseite, 404-Seite, Admin-Anmeldung laden, Browserkonsole ohne Hydrierungsfehler (Chromium-Skript wie in `project_state`, Lehre vom 15.11.2026).
- [ ] **Step 5: Commit** `refactor(i18n): Entferne die Sprache als Modulkonstante (#94)`.

---

## Selbstprüfung gegen den Entwurf

- 5.1 `getTranslators()`: Task 1. 5.2 Aufrufer: Task 3 bis 5. 5.3 Zwischenspeicher: Task 4. 5.4 Feld, Migration, Auswahl: Task 2. 5.5 Datum: Task 2 (virtuelles Feld). 5.6 SMS: Task 5, Schritt 5. Abschnitt 6 Tests: Tasks 1 bis 6. Abschnitt 7 Lieferung: Reihenfolge der Tasks.
- Nicht Teil im PR: Admin folgt der Einstellung (Schritt 4), Handbuch und Änderungsprotokoll (Schritt 5), #90, SMS-Standardtexte falls verschoben.
