# Berichtsseite für die Verfügbarkeit: Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine Berichtsseite im Admin-Bereich, die Verfügbarkeit, Ausfalldauer, Verlauf und Zielwert für alle Gruppen oder eine gewählte Gruppe zeigt, mit Auswahl von Zeitraum, Gruppe, Rechenart, Wartungsart und Anzahl der schwächsten Dienste auf der Seite selbst.

**Architecture:** Alle Rechnungen liegen in reinen Funktionen unter `src/lib/report/` und werden mit `tsx --test` geprüft. Eine Ladefunktion holt die Daten über Payload. Eine JSON-Route und die Admin-Ansicht rufen dieselbe Ladefunktion auf. Die Darstellung besteht aus reinen React-Komponenten ohne Payload-Abhängigkeit, die als Text gerendert und geprüft werden.

**Tech Stack:** TypeScript, Payload 3.90.2 (eigene Admin-Ansicht über `admin.components.views`), React Server Components, SVG ohne Bibliothek, `tsx --test`, Playwright (nur für die JSON-Route).

**Spec:** `docs/superpowers/specs/2026-11-11-verfuegbarkeitsbericht-design.md`, Abschnitte 4, 5.2, 6 und 9; Ist-Stand `docs/superpowers/specs/2026-11-12-stoerung-benachrichtigung-wartung-ist-stand.md`. Issue #49 im Fork (GitHub). Entwurf der Seite: `https://<test-host>/_edge/bericht.html`.

## Global Constraints

- Verfügbarkeit: Anteil der bekannten Zeit ohne `partial` und `major`; Anzeige mit zwei Nachkommastellen, abgerundet (`formatAvailability` in `src/lib/availability.ts`). Eingeschränkt und Wartung als eigene Zeilen.
- Wartungsarten (Konzept 4.7): **A** Wartung verfügbar, Störungen in der Wartung zählen nicht (Voreinstellung); **B** Wartung als Ausfall; **C** Wartung aus der Gesamtzeit herausgenommen. Beispiel zur Prüfung: T = 44.640 Minuten, Störung 90 Minuten außerhalb der Wartung, Wartung 600 Minuten: A 99,79 %, B 98,45 %, C 99,79 %.
- Wartungszeit nach Konzept 4.8 (tatsächliche Zeit, soweit erfasst, sonst geplante Zeit; Tabelle dort), **nur aus den erfassten Wartungen**. Der Zustand „Wartung“ im Protokoll zählt nicht als Wartungszeit und wird wie „Betriebsbereit“ behandelt. Voraussetzung: Issue #57 im Fork (Umwandlung der Wartungsvorfälle in Wartungen) ist umgesetzt, sonst fehlt die Wartungszeit der Vergangenheit.
- Rechenart 1 (Standard): ein Wert für den ganzen Zeitraum. Rechenart 2: Mittel der Monatswerte.
- Zielwert: `resolveAvailabilityTarget` (Dienst vor Gruppe vor Gesamt, Standard 99). „Monate mit erreichtem Ziel“ zählt Monate mit Wert größer oder gleich Zielwert.
- Gruppen- und Gesamtwert: Mittelwert der Dienste, jeder gleich gewichtet (Konzept 9, Annahmen 3 und 4).
- Schwächste Dienste: Standard 5, Minimum 3, Maximum 10, nur Dienste mit mindestens einem Ausfall.
- Zugriff: nur angemeldete Administratoren (Konzept 9, Annahme 1).
- Farbstufen der Wärmekarte ohne Rot-Grün-Paar: Blau, Gelb, Rot. Schriften lokal, keine Google Fonts.
- Zeitgrenzen (Monat, Quartal, Jahr) in der Zeitzone aus den Einstellungen, nicht in UTC. `zonedDateToUtc` in `src/lib/datetime.ts`.
- Branch `feature/49-berichtsseite`. Commits `<typ>(<scope>): <Beschreibung> (#49)`, Imperativ, erste Zeile höchstens 50 Zeichen, Ende mit `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Squash-Merge, PR-Body mit „Nicht Teil dieses PR“, kein `--fill`, `gh` immer mit `-R xalbrecht/yet-another-status-page`.
- Das Admin-Panel wird in der E2E-Umgebung nicht getestet (zu langsam, `tests/e2e/admin.spec.ts` ist übersprungen). Die Ansicht wird deshalb über reine Komponenten und eine JSON-Route geprüft, die Seite selbst von Hand auf Dev.
- TypeScript-Dateien dieses Forks tragen keinen Dateikopf.

## Review Focus

1. Ein Dienst, der im Zeitraum keine bekannte Zeit hat: Wert „–“ statt 100 % oder `NaN` (Test in Task 3).
2. Eine Wartung, die über Beginn oder Ende des Zeitraums hinausreicht, und eine noch laufende Wartung: Kürzung auf den Zeitraum (Test in Task 2 und 3).
3. Ungültige Eingaben in der Adresse (Zeitraum „2026-13“, freier Zeitraum mit Ende vor Beginn, unbekannte Gruppe, `topN=99`): Fehlermeldung beziehungsweise Standardwert, kein Absturz (Test in Task 1 und 4).
4. Monatsgrenzen bei Sommerzeit in `Europe/Berlin` (Test in Task 1).
5. Zugriff ohne Anmeldung ist gesperrt (Task 5, Prüfung von Hand mit `PAYLOAD_PUBLIC_ALLOW_WRITES=false`).

---

### Task 1: Zeiträume (`src/lib/report/period.ts`)

**Files:** Create `src/lib/report/period.ts`, `tests/unit/report-period.test.ts`.

**Interfaces:**
- Produces: `type ReportPeriod = { key: string; label: string; start: number; end: number; partial: boolean }` (`end` ausschließlich, in Millisekunden UTC)
- Produces: `resolvePeriod(input: { period?: string; from?: string; to?: string }, now: number, timeZone: string, locale: string): { ok: true; period: ReportPeriod; previous: ReportPeriod; months: ReportPeriod[] } | { ok: false; error: string }`
- Schlüssel: `2026-10` (Monat), `2026-Q3`, `2026-H1`, `2026`, `custom` mit `from` und `to` als `YYYY-MM-DD` (beide Tage eingeschlossen). Ohne Angabe: der letzte abgeschlossene Monat.

- [ ] **Step 1: Test** `tests/unit/report-period.test.ts` mit `timeZone = 'Europe/Berlin'`: `2026-10` hat `start = zonedDateToUtc(2026-10-01 00:00)` und `end = zonedDateToUtc(2026-11-01 00:00)` (Sommerzeit endet am 25.10.2026: Länge 745 Stunden); `2026-Q3` umfasst Juli bis September; `2026-H1` Januar bis Juni; `previous` von `2026-10` ist `2026-09`, von `2026-Q3` ist `2026-Q2`, von `custom` mit 10 Tagen die 10 Tage davor; `months` hat 12 Einträge, aufsteigend, der letzte ist der Monat des Periodenendes; liegt `now` im Zeitraum, ist `partial` wahr und `end` gleich `now`; `resolvePeriod({ period: '2026-13' })`, `{ period: 'custom', from: '2026-10-05', to: '2026-10-01' }` und Unsinn liefern `ok: false` mit deutschem Text (Review Focus 3 und 4).
- [ ] **Step 2: Fehlschlag** `npm run test:unit` → FAIL (Modul fehlt).
- [ ] **Step 3: Implementieren** mit `zonedDateToUtc` aus `@/lib/datetime`. Label über `Intl.DateTimeFormat(locale)`.
- [ ] **Step 4: Grün** `npm run test:unit` → PASS, `npm run typecheck` und `npm run lint` ohne Befund.
- [ ] **Step 5: Commit** `feat(bericht): Berechne Berichtszeiträume (#49)`

### Task 2: Wartungszeit (`src/lib/report/maintenance-time.ts`)

**Files:** Create `src/lib/report/maintenance-time.ts`, `tests/unit/report-maintenance-time.test.ts`.

**Interfaces:**
- Produces: `type MaintenanceInput = { status: string; scheduledStartAt: string; scheduledEndAt?: string | null; completedAt?: string | null; cancelledAt?: string | null; updates: Array<{ status: string; createdAt: string }>; serviceIds: number[] }`
- Produces: `maintenanceWindow(maintenance: MaintenanceInput, now: number): { from: number; to: number } | null`

- [ ] **Step 1: Test**, eine Zeile je Fall der Tabelle in Konzept 4.8: abgeschlossen mit Aktualisierungen (geplant 20:00–22:00, „Läuft“ 20:10, „Abgeschlossen“ 23:15) → 20:10 bis 23:15 (185 Minuten); abgeschlossen ohne Aktualisierungen → geplante Zeit; laufend → `to = now`; abgebrochen mit „Läuft“-Aktualisierung → bis `cancelledAt`; abgebrochen ohne Start (`scheduledStartAt` nach `cancelledAt`, keine Aktualisierung) → `null`; geplant → `null`; `to <= from` → `null`.
- [ ] **Step 2:** `npm run test:unit` → FAIL. **Step 3:** Funktion nach den Regeln der Tabelle implementieren. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(bericht): Ermittle die Wartungszeit (#49)`

### Task 3: Kennzahlen je Dienst (`src/lib/report/metrics.ts`)

**Files:** Create `src/lib/report/metrics.ts`, `tests/unit/report-metrics.test.ts`.

**Interfaces:**
- Consumes: `Timeline`, `statusAt` aus `@/lib/availability`; Fenster aus Task 2
- Produces: `type MaintenanceMode = 'A' | 'B' | 'C'`
- Produces: `computeServiceMetrics(input: { timeline: Timeline; windows: Array<{ from: number; to: number }>; start: number; end: number; mode: MaintenanceMode }): { knownMs: number; downMs: number; degradedMs: number; maintenanceMs: number; availability: number | null; outages: Array<{ from: number; to: number; status: 'partial' | 'major' }> }`
- Regel: Der Zeitraum wird in Abschnitte geteilt (Grenzen: Einträge der Zeitleiste und Fenster, gekürzt auf `start` bis `end`). „In Wartung“ gilt **nur** für die Fenster. Ein Zustand `maintenance` in der Zeitleiste zählt wie `operational`. Art A: Abschnitt in Wartung zählt als verfügbar. Art B: Abschnitt in Wartung zählt als Ausfall. Art C: Abschnitt in Wartung fällt aus bekannter Zeit und Ausfall heraus. `degradedMs` zählt `degraded` ohne Wartung. `outages` fasst aneinandergrenzende Abschnitte mit `partial` oder `major` ohne Wartung zusammen.

- [ ] **Step 1: Test** mit festen Werten: Dienst bekannt ab Zeitraumbeginn, `T = 44_640 * 60_000`; Störung `partial` 90 Minuten außerhalb der Wartung; Wartungsfenster 600 Minuten mit 30 Minuten `partial` darin: Art A `availability` ≈ 99.7984 (`formatAvailability` 99,79 %), Art B ≈ 98.4543 (98,45 %), Art C ≈ 99.7956 (99,79 %); `maintenanceMs` = 600 Minuten in allen Arten; `outages` hat genau einen Eintrag (die 90 Minuten) in A und C; Zeitleiste leer → `availability` = `null` (Review Focus 1); Fenster ragt über `end` hinaus und ein Fenster ohne Ende (`to = now` vor `end`) werden gekürzt (Review Focus 2); Eingeschränkt 3 Stunden → `degradedMs` = 3 Stunden, `availability` = 100; ein Zustand `maintenance` in der Zeitleiste ohne Fenster → `maintenanceMs` = 0 und `availability` = 100.
- [ ] **Step 2:** `npm run test:unit` → FAIL. **Step 3:** Implementieren (Abschnitte bilden, je Abschnitt Art anwenden). **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(bericht): Berechne Kennzahlen je Dienst (#49)`

### Task 4: Zusammenfassung und Berichtsdaten (`src/lib/report/aggregate.ts`)

**Files:** Create `src/lib/report/aggregate.ts`, `tests/unit/report-aggregate.test.ts`, `src/lib/report/params.ts`.

**Interfaces:**
- Consumes: `resolvePeriod` (Task 1), `computeServiceMetrics` (Task 3), `resolveAvailabilityTarget`, `formatAvailability` aus `@/lib/availability`
- Produces in `params.ts`: `type ReportParams = { period?: string; from?: string; to?: string; group?: string; calc: 'whole' | 'monthly'; maintenance: MaintenanceMode; showMaintenance: boolean; topN: number }` und `parseReportParams(search: Record<string, string | string[] | undefined>): ReportParams` (Standard: `calc = 'whole'`, `maintenance = 'A'`, `showMaintenance = true` (Wartungszeile ein- und ausblendbar, ohne Einfluss auf die Prozentzahl), `topN = 5`, `topN` auf 3 bis 10 begrenzt, ungültige Werte auf Standard)
- Produces in `aggregate.ts`: `buildReport(input: ReportInput): ReportData` mit `ReportInput = { period; previous; months; params; globalTarget: number; groups: Array<{ id: number; name: string; target?: number | null }>; services: Array<{ id: number; name: string; groupId: number; target?: number | null; timeline: Timeline; windows: Array<{ from: number; to: number }> }>; footnotes: { unsure: number; withoutService: number } }`
- `ReportData`: `kpis` (Verfügbarkeit, Wert des Zeitraums davor, Ausfallzeit, Ausfallzeit davor, betroffene Dienste von n, Anzahl Ausfälle, längster Ausfall mit Dienstname, Eingeschränkt- und Wartungszeit, Monate mit erreichtem Ziel von n, Zielwert), `weakest` (nach Verfügbarkeit aufsteigend, nur mit Ausfall, höchstens `topN`), `trend` (12 Monate), `heat` (Zeilen: Gruppen, bei gewählter Gruppe deren Dienste; Spalten: 12 Monate; Gesamtzeile), `ranking` (alle Dienste, schwächste zuerst, mit Wert, Wert davor, Ausfalldauer, Anzahl, längster Ausfall, Verlauf, Vermerk „unter Ziel“), `footnotes`, optional `error` (Text bei ungültiger Eingabe).

- [ ] **Step 1: Tests** (`report-aggregate.test.ts`): Gruppenwert = Mittel der Dienste (zwei Dienste 100 % und 98 % → 99 %); Rechenart 2 = Mittel der Monatswerte, Rechenart 1 = ein Wert (die Beispiele KFZ-Zulassung aus Konzept 4.2 liegen als Eingabe bei: 98,554 % und 98,574 %); „Monate mit erreichtem Ziel“ = 8 von 12 bei einer Gruppe mit vier Monaten unter 99; Zielwert je Dienst wird mit `resolveAvailabilityTarget` aufgelöst (Gruppenziel 98 gilt für einen Dienst ohne eigenen Wert); `weakest` hat bei `topN = 5` höchstens 5 Zeilen und enthält keinen Dienst ohne Ausfall; Gruppenauswahl liefert Zeilen der Dienste statt der Gruppen; unbekannte Gruppe in `params.group` → `ReportData.error` gesetzt statt Ausnahme (Review Focus 3). `params.test`: `topN=99` → 10, `topN=1` → 3, `maintenance=X` → `'A'`, `calc=foo` → `'whole'`.
- [ ] **Step 2:** `npm run test:unit` → FAIL. **Step 3:** Implementieren; `previous`-Werte mit demselben Verfahren. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(bericht): Fasse Berichtsdaten zusammen (#49)`

### Task 5: Laden, Route und Zugriff

**Files:** Create `src/lib/report/load.ts`, `src/app/api/availability-report/route.ts`, `tests/e2e/availability-report.spec.ts`.

**Interfaces:**
- Consumes: `buildReport`, `parseReportParams`, `resolvePeriod`, `maintenanceWindow`, `summarizeClassification` aus `@/lib/incident-classification`
- Produces: `loadReport(payload: Payload, search: Record<string, string | string[] | undefined>, now?: number): Promise<{ data: ReportData; params: ReportParams; period: ReportPeriod; groups: Array<{ id: number; name: string }> } | { error: string }>` — liest Gruppen, Dienste, Statusprotokoll (alle Einträge bis `period.end`, je Dienst der letzte vor `months[0].start` dazu), Wartungen mit Überschneidung, Einstellungen (`availabilityTarget`, `timezone`, `locale`), Vorfälle für die Fußnoten (Vorfälle im Zeitraum vor dem frühesten Betriebseintrag, `summarizeClassification`).
- Produces: `GET /api/availability-report?<Auswahl>` liefert `ReportData` als JSON; ohne Anmeldung 401 (im Testmodus `PAYLOAD_PUBLIC_ALLOW_WRITES=true` offen wie bei den übrigen Routen, Muster `authenticatedOrTestWrite` aus `src/lib/access.ts`).

- [ ] **Step 1: E2E-Test** `tests/e2e/availability-report.spec.ts`: legt Gruppe, zwei Dienste und eine Störung über die API an (Muster `tests/e2e/lagebild.spec.ts`), ruft `/api/availability-report?period=<aktueller Monat>&group=<id>` auf und erwartet Status 200, `kpis.serviceCount` = 2 und `ranking` mit den zwei Diensten; `?period=2026-13` liefert Status 400 mit Fehlertext; `?topN=99` liefert höchstens 10 Einträge in `weakest`.
- [ ] **Step 2:** Test gegen die Docker-Umgebung (`docs/src/development/testing.md`, `E2E_CA_FILE`) → FAIL (Route fehlt).
- [ ] **Step 3:** `load.ts` und Route implementieren, `buildReport` nur mit den Daten aus `load.ts` füttern.
- [ ] **Step 4:** E2E-Test → PASS. **Step 5:** Zugriff ohne Anmeldung von Hand prüfen: Umgebung mit `PAYLOAD_PUBLIC_ALLOW_WRITES=false` (drittes `-f`, siehe `docs/src/development/testing.md`), `curl /api/availability-report` → 401 (Review Focus 5).
- [ ] **Step 6: Commit** `feat(bericht): Lade den Bericht und liefere ihn aus (#49)`

### Task 6: Darstellung und Admin-Ansicht

**Files:** Create `src/components/admin/availability-report/ReportView.tsx`, `ReportControls.tsx`, `TrendChart.tsx`, `Heatmap.tsx`, `report.scss`, `index.tsx`, `AvailabilityReportNavLink.tsx`, `tests/unit/report-view.test.tsx`; Modify `payload.config.ts`, `src/lib/i18n/admin.ts`, `package.json` (Skript `test:unit` um `tests/unit/*.test.tsx` erweitern), `src/app/(payload)/admin/importMap.js` (generiert).

**Interfaces:**
- Consumes: `loadReport` (Task 5)
- Produces: `ReportView(props: { data: ReportData; params: ReportParams; groups: Array<{ id: number; name: string }>; locale: string })` als reine Komponente; `ReportControls` (Client-Komponente) mit Auswahlfeldern `period`, `group`, `calc`, `maintenance`, `showMaintenance`, `topN`, die bei Änderung die Adresse mit den neuen Parametern aufruft (`router.push`); `AvailabilityReportView` (Server-Komponente, Eintrag der Admin-Ansicht).
- Ansicht unter `/admin/verfuegbarkeitsbericht`, Menüpunkt „Verfügbarkeitsbericht“ über `admin.components.afterNavLinks`, Ansicht über `admin.components.views` mit `path: '/verfuegbarkeitsbericht'`. Ohne angemeldeten Nutzer: Weiterleitung zur Anmeldung.

- [ ] **Step 1: Test** `tests/unit/report-view.test.tsx` (`renderToStaticMarkup` aus `react-dom/server`): enthält die Überschrift mit dem Zeitraum, „99,71 %“ aus einem festen `ReportData`, den Vermerk „unter Ziel“ bei einem Dienst unter 99 %, die zwei Fußnoten mit den Zahlen, die Auswahlfelder mit den gesetzten Werten (`calc`, `maintenance`, `showMaintenance`, `topN`), die Wartungszeile nur bei `showMaintenance`, keine Farbklasse mit „green“ und „red“ gemeinsam in der Wärmekarte, und bei `data.error` die Fehlermeldung statt der Tabellen.
- [ ] **Step 2:** `npm run test:unit` → FAIL. **Step 3:** Komponenten nach dem Entwurf bauen (Kennzahlen, schwächste Dienste, Verlauf mit Zielwertlinie, Wärmekarte mit Gesamtzeile und „Alle anzeigen“, Rangliste mit Ausfalldauer als Balken, Fußnoten). Texte über `ta()` mit deutschen Übersetzungen in `src/lib/i18n/admin.ts`. Styles in `report.scss` mit Variablen des Admin-Themes, Hell und Dunkel.
- [ ] **Step 4:** Ansicht und Menüpunkt in `payload.config.ts` eintragen, `npm run generate:importmap`, `npm run typecheck` und `npm run lint`. **Step 5:** `npm run test:unit` → PASS.
- [ ] **Step 6: Commit** `feat(bericht): Zeige die Berichtsseite im Admin (#49)`

### Task 7: Prüfung von Hand, Dokumentation und PR

**Files:** Create `docs/src/admin/availability-report.md`; Modify `docs/src/SUMMARY.md`, `docs/src/development/testing.md`.

- [ ] **Step 1:** Dokumentation der Seite (Auswahlfelder, Berechnungsarten, Fußnoten) auf Englisch im Stil von `docs/src/admin/situation-overview.md`, Eintrag in `docs/src/SUMMARY.md`; `testing.md` um die neuen Tests ergänzen.
- [ ] **Step 2:** Gesamtlauf: `npm run test:unit`, `npm run typecheck`, `npm run lint`, gesamter E2E-Lauf → keine Fehlschläge.
- [ ] **Step 3:** Von Hand auf einer Kopie der Dev-Datenbank oder auf Dev nach der Auslieferung: Seite öffnen, jede Auswahl ändern (Adresse folgt), Gruppe wählen, Wartungsart A, B, C vergleichen (Beispiel mit Wartung), Oktober 2026 gegen den Entwurf prüfen (MACH und Infoma am schwächsten), Hell- und Dunkelmodus, Handy-Breite, ohne Anmeldung (Weiterleitung).
- [ ] **Step 4:** PR `feat(bericht): Ergänze die Berichtsseite (#49)` gegen `main`, Beschreibung mit Kontext, Änderungen, Prüfung und „Nicht Teil dieses PR“ (Export #50, Verlauf der Auswirkung und Neuberechnung, Zielwerte je Gruppe und Dienst, Gewichtung des Teilausfalls, Servicezeiten). `Closes #49` im Squash-Text.
