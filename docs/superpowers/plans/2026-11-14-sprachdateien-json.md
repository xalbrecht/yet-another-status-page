# Texte in JSON-Sprachdateien überführen: Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alle Oberflächentexte liegen in `locales/de.json` und `locales/en.json`; `t()`, `tf()` und `ta()` lesen daraus; das sichtbare Verhalten bleibt unverändert.

**Architecture:** Die JSON-Dateien werden wie heute die Wörterbücher zur Buildzeit eingebunden (Laden aus einem Verzeichnis zur Laufzeit ist Schritt 2). `NEXT_PUBLIC_UI_LANG` gilt weiter. Die 338 `ta()`-Aufrufe mit deutschem Text als zweitem Argument verlieren dieses Argument; ein einmaliges Skript (nicht eingecheckt) verschiebt die Texte nach `de.json`.

**Tech Stack:** TypeScript, Next.js 16, Payload 3.90.2, `tsx --test` (Node-Testläufer), TypeScript-Compiler-API für das Skript.

**Spec:** `docs/superpowers/specs/2026-11-14-sprachdateien-design.md` (Abschnitte 4.2 und 9, Schritt 1). Issue #87 im Fork (GitHub), übergeordnet #60.

## Global Constraints

- Verhalten unverändert: Für `NEXT_PUBLIC_UI_LANG=de` und `=en` liefert jede Stelle denselben Text wie vor der Änderung.
- Namen `t()`, `tf()`, `ta()` und `TranslationKey` bleiben; Importpfade `@/lib/i18n` und `@/lib/i18n/admin` bleiben.
- Dateiformat (Abschnitt 4.2): `{ "meta": { "name", "dateLocale" }, "site": {…}, "admin": {…} }`, UTF-8, Zeichen wie „ “ – unverändert, nicht als `\u`-Escapes.
- `en.json`: `meta.name` „English“, `dateLocale` `en-US`, `site` vollständig, `admin` leer (der englische Text ist Schlüssel und Rückfall). `de.json`: „Deutsch“, `de-DE`.
- Kollisionen (Abschnitt 4.2): Schlüssel mit Zusatz `Text|kontext`, Aufrufstelle `ta('Text', 'kontext')`. Fehlt der Schlüssel mit Zusatz, gilt der Text vor dem `|`.
- Platzhalter `{name}` (für `tf()`) und `{{name}}` (Vorlagensyntax) bleiben Zeichen für Zeichen erhalten.
- Öffentlicher Fork: keine internen Hostnamen, Pfade, Projektnamen in Dateien, Commits, PR-Text.
- Nie auf `main` committen. Commit-Format `<typ>(<scope>): <Imperativ> (#87)`, erste Zeile ≤ 50 Zeichen. PR-Text endet mit der Schlusszeile `🤖 Mit Unterstützung von [Claude Code](https://claude.com/claude-code) erstellt`.

## Review Focus

- Englischer Text mit `|` oder Doppelpunkt als Schlüssel: Zusatzsuche darf keinen normalen Text zerlegen (`ta('A | B')` liefert den Eintrag `A | B`, nicht `A`).
- Unbekannter Zusatz (`ta('Admin', 'gibtsnicht')`) liefert die Fassung ohne Zusatz, nicht den Zusatz selbst.
- Der eine Aufruf mit Template-Literal (`src/lib/report/export/mail.ts`, Zahl im Text) darf kein Schlüssel mit eingesetzter Zahl werden.
- Text fehlt in `de.json` `admin`: `ta()` liefert den englischen Text, kein Fehler.
- Typografische Anführungszeichen und `{{siteName}}` überstehen den Weg Quelltext → JSON → Ausgabe unverändert.

---

### Task 1: Texte der Statusseite nach JSON (`site`)

**Files:**
- Create: `locales/de.json`, `locales/en.json` (zunächst nur `meta` und `site`)
- Create: `tests/unit/locales.test.ts`
- Modify: `src/lib/i18n/index.ts` (liest aus den JSON-Dateien)
- Delete (am Ende der Aufgabe): `src/lib/i18n/de.ts`, `src/lib/i18n/en.ts`

**Interfaces:**
- Produces: `type TranslationKey = keyof typeof enJson.site`; `t(key: TranslationKey): string`, `tf(key, vars)` unverändert; `lang` und `Lang` unverändert.

- [ ] **Step 1: Wegwerf-Vergleich vorbereiten.** Ein Skript im Scratchpad (nicht einchecken) erzeugt aus den noch vorhandenen `de.ts`/`en.ts` die Dateien `locales/de.json` und `locales/en.json` (`meta` + `site`, Schlüsselreihenfolge wie im Quelltext, Einrückung 2 Leerzeichen, `JSON.stringify(…, null, 2)` mit abschließendem Zeilenumbruch) und vergleicht danach jeden Schlüssel beider Sprachen mit den TypeScript-Wörterbüchern per `assert.deepStrictEqual`. Erwartet: keine Abweichung.
- [ ] **Step 2: Test schreiben** in `tests/unit/locales.test.ts` (`node:test`): `site`-Schlüsselmengen von `de.json` und `en.json` sind gleich; kein Wert ist leer; je Schlüssel stimmen die Mengen der `{name}`- und `{{name}}`-Platzhalter in Deutsch und Englisch überein (Regex `/\{\{?\w+\}?\}/g`); `meta.name` und `meta.dateLocale` sind nicht leer.
- [ ] **Step 3: Test ausführen.** `npx tsx --test tests/unit/locales.test.ts`. Erwartet: PASS (die Dateien aus Step 1 liegen vor). Schlägt ein Platzhaltervergleich an, ist das ein echter Unterschied im bisherigen Wörterbuch: melden, nicht stillschweigend angleichen.
- [ ] **Step 4: `src/lib/i18n/index.ts` umstellen.** `import deJson from '../../../locales/de.json'` und `enJson` entsprechend; `TranslationKey` aus `enJson.site`; Wörterbuch `Record<Lang, Record<TranslationKey, string>>` aus `deJson.site` und `enJson.site`. `t()`/`tf()` bleiben inhaltlich gleich, Rückfall `en`. Nichts anderes ändern.
- [ ] **Step 5: `de.ts` und `en.ts` löschen**, `grep -rn "i18n/de\|i18n/en\|from './de'\|from './en'" src tests` liefert keinen Treffer. `npm run typecheck` und `npm run test:unit` laufen ohne Fehler.
- [ ] **Step 6: Commit.** `git add locales tests/unit/locales.test.ts src/lib/i18n && git commit` mit `refactor(i18n): Lege Statusseitentexte in JSON ab (#87)`.

---

### Task 2: Texte des Admins nach JSON (`admin`) und `ta()` umstellen

**Files:**
- Modify: `locales/de.json` (Block `admin`), `locales/en.json` bleibt `"admin": {}`
- Modify: `src/lib/i18n/admin.ts` (nur noch `ta()`), 50 Dateien mit `ta()`-Aufrufen
- Modify: `src/lib/report/export/mail.ts:129` (Template-Literal)
- Modify: `tests/unit/locales.test.ts`

**Interfaces:**
- Consumes: `deJson` aus Task 1.
- Produces: `ta(en: string, context?: string): string`. Reihenfolge: bei `lang === 'de'` zuerst `deJson.admin[`${en}|${context}`]`, dann `deJson.admin[en]`, sonst `en`; bei `lang !== 'de'` immer `en`.

- [ ] **Step 1: Tests für `ta()` schreiben** (rot): `ta('Admin')` mit `NEXT_PUBLIC_UI_LANG=de` liefert die Fassung ohne Zusatz; `ta('Admin', 'role')` die mit Zusatz; unbekannter Zusatz liefert die Fassung ohne Zusatz; Text mit `|` im Namen liefert den eigenen Eintrag; Text, der nicht in `de.json` steht, liefert den englischen Text; mit `=en` liefern alle Aufrufe den englischen Text. Die Sprache setzt der Test über `process.env.NEXT_PUBLIC_UI_LANG` **vor** einem dynamischen `await import('../../src/lib/i18n/admin')` (die Sprache wird beim Laden des Moduls gelesen); dafür je Sprache ein eigener Testlauf mit eigener Datei oder `--import`-freier Unterprozess, wenn der Modulcache stört. Ausführen: Erwartet FAIL.
- [ ] **Step 2: Skript im Scratchpad (nicht einchecken)** mit der TypeScript-Compiler-API (`typescript` ist installiert). Es liest alle `*.ts`/`*.tsx` unter `src/` und `payload.config.ts`, findet jeden Aufruf von `ta(` (auch über mehrere Zeilen) und schreibt eine Datei mit: (a) allen Aufrufen mit zweitem Argument als Zeichenkettenliteral, (b) allen Aufrufen mit Template-Literal oder anderem nicht-literalen Argument (Erwartung: genau einer, `mail.ts:129`), (c) allen Kollisionen, das heißt gleicher englischer Text mit verschiedenen deutschen Texten, einschließlich Abweichungen vom bisherigen Eintrag in `admin.ts`. Erwartung für (c): mindestens `Incidents`, `Admin`, `Media`. Ausführen im Probelauf **ohne zu schreiben** und die Zahlen prüfen: 338 Aufrufe mit Literal, 266 verschiedene Texte, die nicht in `admin.ts` stehen.
- [ ] **Step 3: Kollisionen entscheiden.** Je Kollision die Fassung, die der Eintrag in `admin.ts` hat (sonst die häufigere), behält den Schlüssel ohne Zusatz. Die andere bekommt den Zusatz (`Admin|role`, `Media|single`, für `Incidents` einen Zusatz nach Aufrufkontext). Das Skript vermerkt die Wahl in seiner Ausgabe. Weitere Kollisionen, die das Skript findet, ebenso behandeln und in der PR-Beschreibung nennen.
- [ ] **Step 4: Skript im Schreibmodus.** Es (a) entfernt das zweite Argument an allen Aufrufen, außer an den Kollisionsstellen, dort wird es durch den Zusatz ersetzt; (b) schreibt `de.json` `admin` aus den 243 Einträgen von `admin.ts`, den 266 neuen Texten und den Zusatzschlüsseln, sortiert nach Schlüssel (`localeCompare('en')`); (c) bricht ab, wenn für einen Aufruf `altes Ergebnis ≠ neues Ergebnis` gilt. Das alte Ergebnis ist `de ?? adminDe[en] ?? en`, das neue das Ergebnis der Suche aus der Interfaces-Zeile. Das Skript prüft das für alle 684 Aufrufe.
- [ ] **Step 5: `src/lib/i18n/admin.ts` umbauen.** Das Wörterbuch `adminDe` und der Kommentar entfallen, `ta(en: string, context?: string)` nach der Interfaces-Zeile. Der Test aus Step 1 ist grün.
- [ ] **Step 6: `mail.ts:129` von Hand.** Der Text bekommt den Platzhalter `{count}` im englischen Schlüssel und im deutschen Eintrag; die Aufrufstelle ersetzt ihn mit `.replace('{count}', String(mails - 1))`. Der Test aus `tests/unit/report-mail.test.ts` bleibt grün.
- [ ] **Step 7: Konfigurationsvergleich Vorher/Nachher.** Ein Wegwerf-Skript lädt `payload.config.ts` (`tsx --tsconfig tsconfig.json`, `await config`) und schreibt alle Zeichenketten der Konfiguration (Collections, Globals, Felder, Optionen) als sortierte JSON-Liste. Einmal auf `main` (in einer zweiten Arbeitskopie `git worktree add`) und einmal auf dem Branch, jeweils mit `NEXT_PUBLIC_UI_LANG=de` und `=en`. Erwartet: `diff` leer, vier Dateien paarweise gleich. Schlägt das Laden ohne Datenbank fehl, die Konfiguration mit einer Platzhalter-`DATABASE_URI` laden (es wird nicht verbunden).
- [ ] **Step 8: Prüfen.** `npm run typecheck`, `npm run lint`, `npm run test:unit` ohne Fehler.
- [ ] **Step 9: Commits** in zwei Schritten, damit der PR lesbar bleibt: erst `locales/de.json`, `admin.ts` und `mail.ts` (`refactor(i18n): Lege Admintexte in JSON ab (#87)`), dann die 338 mechanisch geänderten Aufrufstellen (`refactor(i18n): Entferne deutsche Texte aus Aufrufen (#87)`). Das Skript selbst bleibt unversioniert.

---

### Task 3: Gesamtprüfung und Pull Request

**Files:** keine neuen.

- [ ] **Step 1: Build.** `npm run build` mit den Variablen aus dem Dockerfile (`DATABASE_URI`, `PAYLOAD_SECRET`, `SKIP_BUILD_STATIC_GENERATION=true`), hinter dem Firmenproxy mit `NODE_EXTRA_CA_CERTS` auf die Zertifikatsdatei. Erwartet: Exit 0.
- [ ] **Step 2: E2E-Suite** in der Testumgebung des Projekts (`docker-compose.test.yml`, Sprache Englisch, Schritte laut `docs/src/development/testing.md`, mit `--workers=1`, frischer Datenbank). Erwartet: dieselbe Anzahl bestandener Tests wie auf `main`, keine neuen Fehler.
- [ ] **Step 3: Deutsche Stichprobe.** Dev-Server oder Testumgebung ohne `NEXT_PUBLIC_UI_LANG`: Startseite, Wartungsseite, Admin-Anmeldung und eine Collection im Browser oder mit `curl` abrufen und mit derselben Seite auf `main` vergleichen (Text per `diff`). Erwartet: keine Abweichung.
- [ ] **Step 4: Branch pushen, PR anlegen** (`gh pr create -R xalbrecht/yet-another-status-page`, nie `--fill`), Text im Schreibmodus GIT: `Closes #87`, Änderungen, Verifikation (Zahlen aus Task 2 Step 2 und 7), Kollisionen, „Nicht Teil dieses PR“ (Schritte 2 bis 5, Verweis auf #60), Schlusszeile. Vor dem Push läuft die Prüfung auf interne Namen; sie wird nie umgangen.
