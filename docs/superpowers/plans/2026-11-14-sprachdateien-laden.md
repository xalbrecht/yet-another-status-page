# Sprachdateien aus einem Verzeichnis laden: Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Server liest beim Start alle Sprachdateien aus `LOCALES_DIR`; die Sprache kommt aus der Laufzeitvariable `DEFAULT_LANGUAGE`; `NEXT_PUBLIC_UI_LANG` und der Build-Zwang entfallen.

**Architecture:** Ein reines Modul baut je Sprache Wörterbücher aus Verzeichnisdatei und eingebauter Fassung (Deutsch, Englisch). Ein Server-Modul (`index.ts`) liest Verzeichnis und Variablen einmal beim Start und liefert `t()`, `tf()`, `ta()` wie bisher. Client-Komponenten und Module, die sie einbinden, bekommen das Wörterbuch über einen React-Kontext bzw. als Parameter. Die Sprache gilt in diesem Schritt für den ganzen Prozess; pro Anfrage wählbar wird sie erst in Schritt 3 (Issue folgt).

**Tech Stack:** TypeScript, Next.js 16 (Lies vor Änderungen an Layout und Server/Client-Grenze `node_modules/next/dist/docs/`, siehe `AGENTS.md`), Payload 3.90.2, `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-11-14-sprachdateien-design.md` (Abschnitte 4.3, 4.5, 4.7, 8 und 9, Schritt 2). Issue #88 im Fork (GitHub), übergeordnet #60.

## Global Constraints

- Die Namen `t()`, `tf()`, `ta()`, `TranslationKey` und die Importpfade `@/lib/i18n` und `@/lib/i18n/admin` bleiben für Server-Code. Verhalten unverändert, wenn `LOCALES_DIR` fehlt und `DEFAULT_LANGUAGE` nicht gesetzt ist (Deutsch).
- Suchreihenfolge je Text (Abschnitt 4.3): Datei der gewählten Sprache im Verzeichnis, eingebaute Fassung derselben Sprache (nur Deutsch, Englisch), eingebautes Englisch. Eine Datei im Verzeichnis gewinnt immer.
- Gültiger Dateiname = Payload-Sprachcode, also ein Schlüssel von `translations` aus `@payloadcms/translations/all`. Gültige Datei = JSON-Objekt mit `meta.name` (nicht leere Zeichenkette), `site` und `admin` (Objekte, deren Werte Zeichenketten sind). Ungültige Dateien werden übersprungen, der Grund geht ins Log, der Start gelingt.
- `LOCALES_DIR` fehlt, ist kein Verzeichnis oder nicht lesbar: kein Fehler, Notfall-Rückfall auf die eingebauten Fassungen, Log nennt den Grund.
- Ist `DEFAULT_LANGUAGE` weder geladen noch eingebaut: Deutsch, Log nennt den Grund. Ohne Variable: Deutsch.
- Nachschlagen nur über eigene Eigenschaften (`Object.hasOwn`), nie über `dict[key]` auf der Prototypkette.
- Öffentlicher Fork: keine internen Hostnamen, Pfade, Projektnamen. Nie auf `main` committen. Commit-Format `<typ>(<scope>): <Imperativ> (#88)`, erste Zeile ≤ 50 Zeichen. PR-Text endet mit `🤖 Mit Unterstützung von [Claude Code](https://claude.com/claude-code) erstellt`.

## Review Focus

- `LOCALES_DIR` zeigt auf eine Datei, ein leeres oder ein nicht lesbares Verzeichnis: Server startet mit eingebautem Deutsch bzw. Englisch.
- Datei mit falscher Form (`site` ist ein Array, ein Wert ist eine Zahl, `meta.name` fehlt, kaputtes JSON, Dateiname `xx.json`): übersprungen, Rest der Dateien geladen, Log nennt Datei und Grund.
- Schlüssel wie `constructor` oder `toString` in `t()`/`ta()`: liefert den Rückfalltext, nie eine Funktion.
- Server und Client zeigen auf jeder Seite denselben Text: keine Hydrierungswarnung (`did not match`) in der Browser-Konsole der E2E-Läufe.
- Eine zweite Sprache (`fr.json` mit drei Einträgen, `DEFAULT_LANGUAGE=fr`): übersetzte Texte französisch, alle übrigen englisch, nicht deutsch.

---

### Task 1: Dateien prüfen, laden, zusammensetzen (rein, testbar)

**Files:**
- Create: `src/lib/i18n/locales.ts` (rein, ohne Dateizugriff), `src/lib/i18n/read-locale-dir.ts` (`import 'server-only'`, liest das Verzeichnis)
- Test: `tests/unit/locales-load.test.ts`

**Interfaces:**
- Produces in `locales.ts`: `type LocaleFile = { meta: { name: string; dateLocale?: string }; site: Record<string, string>; admin: Record<string, string> }`; `parseLocaleFile(code: string, raw: unknown, accepted: readonly string[]): { file: LocaleFile } | { problem: string }`; `selectLanguage(requested: string | undefined, available: readonly string[]): { language: string; problem?: string }`; `buildSiteDictionary(language: string, files: Record<string, LocaleFile>, builtin: Record<string, LocaleFile>): Record<string, string>`; `buildAdminDictionary` mit derselben Signatur; `lookup(dict: Record<string, string>, key: string): string | undefined` (nur eigene Eigenschaften, nur Zeichenketten).
- Produces in `read-locale-dir.ts`: `readLocaleDir(dir: string, accepted: readonly string[]): { files: Record<string, LocaleFile>; problems: string[] }`.

- [ ] **Step 1: Tests schreiben** (rot, jeweils Name und Zusicherung): gültige Datei wird geparst; Dateiname `xx` oder nicht in `accepted` liefert ein `problem`; `site` als Array, Wert als Zahl, fehlendes oder leeres `meta.name`, JSON `null` liefern je ein `problem`; `selectLanguage(undefined, ['de'])` → `de`; `selectLanguage('fr', ['de','en'])` → `de` mit `problem`; `buildSiteDictionary('fr', {fr}, builtin)` liefert Text aus `fr`, sonst englischen eingebauten Text, nie den deutschen; `buildSiteDictionary('de', {}, builtin)` liefert die eingebaute deutsche Fassung; Datei im Verzeichnis überschreibt die eingebaute Fassung je Schlüssel; `lookup(dict, 'constructor')` und `lookup(dict, 'toString')` liefern `undefined`; `readLocaleDir` auf ein temporäres Verzeichnis (`fs.mkdtempSync`) mit einer gültigen, einer kaputten und einer `xx.json`-Datei liefert genau die gültige und zwei Probleme, auf ein nicht vorhandenes Verzeichnis und auf eine Datei liefert es leere `files` und ein Problem. Ausführen: `npx tsx --test tests/unit/locales-load.test.ts`. Erwartet: FAIL (Module fehlen).
- [ ] **Step 2: `locales.ts` implementieren** nach den Signaturen. `builtin` ist ein Parameter, die Funktionen kennen die JSON-Dateien nicht.
- [ ] **Step 3: `read-locale-dir.ts` implementieren.** `fs.readdirSync`, nur `*.json`, jede Datei in `try/catch`, Problemtexte nennen Dateiname und Grund. Dateien in Name-Reihenfolge.
- [ ] **Step 4: Tests ausführen.** Erwartet: PASS. `import 'server-only'` stört `tsx --test` nicht; stört es doch, das Paket im Test per `--import` oder Alias ersetzen und als Ruling ins Ledger.
- [ ] **Step 5: Commit** `feat(i18n): Lade und prüfe Sprachdateien (#88)`.

---

### Task 2: Server-API auf geladene Wörterbücher umstellen

**Files:**
- Modify: `src/lib/i18n/index.ts`, `src/lib/i18n/admin.ts`, `payload.config.ts` (Zeilen um `i18n.supportedLanguages`), `docker-compose.test.yml`, `src/lib/email.ts`, `src/app/not-found.tsx`, `src/app/(frontend)/layout.tsx` (nur Importe von `lang`, falls nötig)
- Test: `tests/unit/admin-text.test.ts` (Signatur), `tests/unit/locales-load.test.ts` (Auswahl)

**Interfaces:**
- Consumes: Task 1.
- Produces in `index.ts` (Server, `import 'server-only'`): `lang: string` (gewählte Sprache), `localeProblems: string[]`, `availableLanguages: string[]`, `getSiteDictionary(): Record<string, string>` (für den Client-Kontext), `t(key: TranslationKey): string`, `tf(key, vars)`. Liest beim Laden des Moduls `process.env.LOCALES_DIR` (Standard `path.join(process.cwd(), 'locales')`) und `process.env.DEFAULT_LANGUAGE`, loggt jedes Problem einmal mit `console.warn('[i18n] …')`.
- Produces in `admin.ts`: `ta(en: string, context?: AdminTextContext): string` unverändert; `resolveAdminText(dict: Record<string, string>, en: string, context?: string): string` (Parameter `language` entfällt, der Aufrufer übergibt das Wörterbuch der gewählten Sprache).

- [ ] **Step 1: Tests anpassen** (rot): `admin-text.test.ts` ruft `resolveAdminText(dict, en, context)` ohne Sprache auf; die Englisch-Prüfung wird zu „leeres Wörterbuch liefert den englischen Text“. Ausführen. Erwartet: FAIL.
- [ ] **Step 2: `admin.ts` ändern.** `ta()` nutzt `buildAdminDictionary(lang, files, builtin)` aus `index.ts` (Zirkelimport vermeiden: `admin.ts` importiert `lang`, Verzeichnisdateien und `builtin` aus einem kleinen internen Modul `src/lib/i18n/state.ts`, das `index.ts` und `admin.ts` gemeinsam nutzen). Jeder Zugriff über `lookup`.
- [ ] **Step 3: `index.ts` und `state.ts` bauen.** `builtin = { de: deJson, en: enJson }` mit `with { type: 'json' }` (Pflicht, siehe `tests/unit/i18n-native-esm.test.ts`). `t()` und `tf()` über `lookup`, Rückfall eingebautes Englisch.
- [ ] **Step 4: `payload.config.ts`:** `supportedLanguages: { [lang]: translations[lang] }` aus `@payloadcms/translations/all`, `fallbackLanguage: lang`. Ist `translations[lang]` nicht vorhanden (Sprache ohne Payload-Texte), `en`.
- [ ] **Step 5: Umgebung.** `docker-compose.test.yml`: `NEXT_PUBLIC_UI_LANG=en` ersetzen durch `DEFAULT_LANGUAGE=en`. `grep -rn NEXT_PUBLIC_UI_LANG src payload.config.ts docker-compose*.yml Dockerfile .github` liefert keinen Treffer.
- [ ] **Step 6: Prüfen.** `npm run typecheck` zeigt jetzt Fehler in Client-Komponenten, die `@/lib/i18n` einbinden (`server-only`): Das ist erwartet und Task 3. Unit-Tests der Tasks 1 und 2 grün.
- [ ] **Step 7: Commit** `feat(i18n): Lies Sprache und Verzeichnis beim Start (#88)`. Der Branch baut erst nach Task 3; kein Push dazwischen.

---

### Task 3: Client-Komponenten und gemeinsame Module

**Files:**
- Create: `src/lib/i18n/core.ts` (rein: `makeTranslators(dict: Record<string, string>): { t: (key: TranslationKey) => string; tf: (key: TranslationKey, vars: Record<string, string | number>) => string }`), `src/lib/i18n/client.tsx` (`'use client'`: `I18nProvider({ dictionary, children })`, `useTranslation(): { t; tf }`, wirft einen Fehler mit klarem Text, wenn der Provider fehlt), `tests/unit/i18n-helpers.tsx` (Hilfsfunktion `withI18n(node)` mit der eingebauten deutschen `site`-Fassung)
- Modify: `src/app/(frontend)/layout.tsx` und `src/app/not-found.tsx` (Provider mit `getSiteDictionary()`, `<html lang={lang}>`), `src/app/(frontend)/error.tsx`, `UnsubscribeClient.tsx`, `ConfirmClient.tsx`, `LoginButton.tsx`, `AllGroupsPanel.tsx`, `Footer.tsx`, `Lagebild.tsx`, `StatusBar.tsx`, `GroupTooltip.tsx`, `src/lib/datetime.ts` (`formatTimezoneNotice(timeZone, tf)`), `src/lib/lagebild.ts` (`statusLabel(status, t)` und weitere Funktionen, die Client-Code aufruft), alle Module, die der Build meldet
- Test: `tests/unit/i18n-core.test.ts` und die vorhandenen Komponententests (`all-groups-panel`, `group-tooltip`, `status-boxes-view`, `report-*-view`), soweit sie Texte rendern

**Interfaces:**
- Consumes: `getSiteDictionary()`, `lang` aus Task 2.
- Produces: `makeTranslators`, `I18nProvider`, `useTranslation` wie oben; geänderte Signaturen der gemeinsamen Funktionen (Parameter `t`/`tf` am Ende, Aufrufer auf dem Server übergeben `t`/`tf` aus `@/lib/i18n`, Client-Aufrufer die aus `useTranslation()`).

- [ ] **Step 1: Test für `makeTranslators` schreiben** (rot): `t` liefert den Text, bei fehlendem Schlüssel den Schlüssel selbst; `tf` ersetzt `{name}`, lässt unbekannte Platzhalter stehen, lässt `{{name}}` unverändert; `t('constructor' as never)` liefert nie eine Funktion. Ausführen. Erwartet: FAIL.
- [ ] **Step 2: `core.ts`, dann `client.tsx` implementieren.** `index.ts` aus Task 2 nutzt `makeTranslators` für `t`/`tf`, damit Server und Client dieselbe Logik haben.
- [ ] **Step 3: Provider einbauen** in `(frontend)/layout.tsx` und `not-found.tsx` (beide rendern `<html>`; der Provider umschließt den Inhalt des `<body>`).
- [ ] **Step 4: Umstellen, bis der Build durchläuft.** Jede Client-Komponente: `import { t, tf } from '@/lib/i18n'` wird zu `const { t, tf } = useTranslation()` im Komponentenkörper (nie auf Modulebene). Gemeinsame Module bekommen `t`/`tf` als Parameter. Die Fehlermeldungen von `npm run typecheck` und `npm run build` (`server-only`) zeigen jede Stelle, auch Dateien ohne `'use client'`, die nur von Clients eingebunden werden (`BarLegend.tsx`, `status-styles.ts`, `StatusLegend.tsx`). Wiederholen, bis beide fehlerfrei sind. Entscheide je Stelle nach dem kleinsten Eingriff und nenne Abweichungen vom Plan als Ruling.
- [ ] **Step 5: Komponententests anpassen.** Gerenderte Komponenten werden mit `withI18n(…)` umhüllt. Erwartet: alle Unit-Tests grün (`npm run test:unit`), Texte unverändert (Deutsch).
- [ ] **Step 6: Commit** in zwei Schritten: `feat(i18n): Stelle Wörterbuch im Client bereit (#88)` (Kern, Provider, Tests), danach `refactor(i18n): Übergib Übersetzer an gemeinsame Module (#88)` (Umstellung der Stellen).

---

### Task 4: Prüfwerkzeug `check-locales`

**Files:**
- Create: `scripts/check-locales.ts`, `tests/unit/check-locales.test.ts`
- Modify: `package.json` (Skript `check:locales`: `tsx scripts/check-locales.ts [Verzeichnis]`)

**Interfaces:**
- Produces: `checkLocales(files: Record<string, LocaleFile>, reference: LocaleFile): { errors: string[]; warnings: string[] }`; das Skript liest `locales/` (oder das übergebene Verzeichnis) mit `readLocaleDir`, vergleicht jede Datei mit `locales/en.json` (Block `site`), gibt Warnungen und Fehler aus und endet mit Exit-Code 1 bei Fehlern.

- [ ] **Step 1: Tests schreiben** (rot): fehlender Schlüssel in `site` → Warnung; überzähliger Schlüssel → Warnung; fehlender oder zusätzlicher Platzhalter (`{timezone}`, `{{siteName}}`, `{count}`) → Fehler; Admin-Eintrag mit abweichenden Platzhaltern gegenüber dem Schlüssel → Fehler; Datei ohne Probleme → keine Meldung. Ausführen. Erwartet: FAIL.
- [ ] **Step 2: Implementieren** nach Signatur. Die Platzhalter-Regex ist dieselbe wie in `tests/unit/locales.test.ts`.
- [ ] **Step 3: Gegen die eigenen Dateien laufen lassen.** `npm run check:locales`. Erwartet: Exit-Code 0, keine Fehler für `de.json` und `en.json`. Die Prüfung läuft zusätzlich in `.github/workflows/e2e-tests.yml` vor den Tests (ein Schritt `npm run check:locales`).
- [ ] **Step 4: Commit** `feat(i18n): Prüfe Sprachdateien mit check-locales (#88)`.

---

### Task 5: Dokumentation der Variablen

**Files:**
- Modify: `docs/src/getting-started/configuration.md` (Abschnitt „Language“, Zeilen um 141 bis 166), `docs/src/development/architecture.md:169`, `docs/src/admin/overview.md:46`, `docs/src/development/local-setup.md:83-86`, `docs/src/development/testing.md:125,167`

- [ ] **Step 1: Texte ersetzen.** `NEXT_PUBLIC_UI_LANG` und „Build“ entfallen. Neu: `DEFAULT_LANGUAGE` (`de`, `en` oder der Code einer geladenen Sprache, Standard `de`), `LOCALES_DIR` (Standard `locales` im Arbeitsverzeichnis, im Docker-Image nicht vorhanden, dann gelten die eingebauten Fassungen), Neustart nach Änderung, Hinweis auf `npm run check:locales`, Beispiel für ein Volume (`./locales:/app/locales:ro`). Ein Absatz zu den Dateien: Format laut `locales/de.json`, Name = Sprachcode. Die Auswahl im Admin folgt in Schritt 3, das steht dort.
- [ ] **Step 2: Prüfen.** `grep -rn NEXT_PUBLIC_UI_LANG docs/src README.md` liefert keinen Treffer; `docs.yml` baut die Doku ohne Fehler, soweit lokal prüfbar.
- [ ] **Step 3: Commit** `docs(i18n): Beschreibe LOCALES_DIR und DEFAULT_LANGUAGE (#88)`.

---

### Task 6: Gesamtprüfung und Pull Request

**Files:** keine neuen.

- [ ] **Step 1: Unit, Typecheck, Lint, Build.** `npm run test:unit`, `npm run typecheck`, `npm run lint`, `npm run build` (Variablen wie im Dockerfile, `NODE_EXTRA_CA_CERTS` auf die Zertifikatsdatei des Betreibers). Erwartet: alles fehlerfrei.
- [ ] **Step 2: Konfigurationsvergleich.** Wie im Plan zu #87 (Wegwerf-Skript, zwei Arbeitskopien), mit `DEFAULT_LANGUAGE=de` und `=en` gegen `main`: identische Zeichenketten bis auf Pfadzeilen.
- [ ] **Step 3: Abnahme am gebauten Server** (Wegwerf-Postgres, `next start` aus dem Build wie beim Vorversuch): (a) `LOCALES_DIR` nicht gesetzt, `DEFAULT_LANGUAGE=en`: Startseite und Anmeldeseite des Admins englisch; (b) `fr.json` mit drei Einträgen (`site` und `admin`, `meta.name` „Français“), `DEFAULT_LANGUAGE=fr`, Neustart ohne Build: die drei Texte französisch, die Payload-Texte des Admins französisch, übrige Texte englisch; (c) zusätzlich `kaputt.json` und `xx.json` im Verzeichnis: Server startet, das Log nennt beide Dateien. Ergebnisse (Texte, Logzeilen) ins Ledger.
- [ ] **Step 4: E2E-Suite** mit `DEFAULT_LANGUAGE=en` über den manuellen Weg aus `docs/src/development/testing.md` (frische Datenbank, ein Worker). Erwartet: dieselbe Anzahl bestandener Tests wie auf `main`, keine Hydrierungswarnung in den Läufen (`grep -c "did not match"` im Log der App-Containers ist 0).
- [ ] **Step 5: Pull Request** (`gh pr create -R xalbrecht/yet-another-status-page`, nie `--fill`): `Closes #88`, Änderungen, Verifikation, Rulings, „Nicht Teil dieses PR“ (Schritte 3 bis 5, übergeordnet #60), Schlusszeile. Vor dem Push läuft die Prüfung auf interne Namen; sie wird nie umgangen.
