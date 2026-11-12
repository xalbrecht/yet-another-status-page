# Gruppenblatt und Tabs der Berichtsseite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Berichtsseite `/admin/verfuegbarkeitsbericht` bekommt zwei Tabs („Gesamtbericht“, „Gruppenberichte“). Der Tab „Gruppenberichte“ zeigt links alle Gruppen, rechts das Gruppenblatt mit fünf Blöcken.

**Architecture:** Die Berechnung bleibt in `src/lib/report/` (reine Funktionen, Unit-Tests). `buildReport` liefert zusätzlich die Gruppenliste (`groupList`) und, bei gewählter Gruppe, die Störungen des Monats (`sheet`). Die Komponenten unter `src/components/admin/availability-report/` stellen sie dar. Die Auswahl steht in der Adresse (`view`, `group`).

**Tech Stack:** Next.js (Server-Komponenten), Payload Admin-View, `node:test` mit `tsx` (Unit-Tests), Playwright (E2E gegen die JSON-Route).

**Spec:** `docs/superpowers/specs/2026-11-12-berichtsexport-design.md` (Abschnitt 4), Issue #64 im Fork (GitHub). Ausgangslage: `docs/superpowers/specs/2026-11-11-verfuegbarkeitsbericht-design.md`.

## Global Constraints

- Branch `feature/64-gruppenblatt` von `main`, nie direkt auf `main`. Commit-Format `<typ>(<scope>): <Imperativ> (#64)`, erste Zeile höchstens 50 Zeichen, Anhang `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Texte der Oberfläche über `ta('English', 'Deutsch')` aus `@/lib/i18n/admin`, nie fest verdrahtet.
- Farben Blau über Gelb zu Rot, kein Grün (Rot-Grün-Sehschwäche). Schwerer Ausfall `#c8402f`, Teilausfall `#e8903a`, Eingeschränkt `#999`.
- Wärmekarte: höchstens 12 Zeilen je Block. Farbstufen 100 %, ab 99,9 %, ab 99,5 %, ab Ziel, unter Ziel (`heatClass`).
- Keine neue Abhängigkeit, keine Google Fonts, keine Datenbankänderung.
- Vorhandene Parameternamen bleiben (`period`, `calc`, `maintenance`, `topN`, `group`). Neu ist nur `view` (`overall` Standard, `groups`). Die Namen `ansicht` und `gruppe` aus dem Konzept entfallen (Abschnitt „Abweichung vom Konzept“).
- TypeScript-Dateien tragen wie die bestehenden unter `src/lib/report/` einen Beschreibungskommentar statt eines Dateikopfs.
- Prüfen mit `npm run test:unit`, `npx tsc --noEmit`, `npm run lint`. E2E nach `docs/src/development/testing.md` (Umgebung siehe dort, hinter dem Firmenproxy `E2E_CA_FILE`).

## Review Focus

- Gruppe mit nur einem Dienst (elf auf Dev): Gruppenblatt und Liste zeigen sie wie jede andere, ohne Fehler (Task 5, 6).
- Gruppe ohne bekannte Daten (Verfügbarkeit `null`): Liste zeigt „–“ und sortiert sie ans Ende, das Blatt bricht nicht ab (Task 3, 5).
- Ausfall über Mitternacht und über die Zeitumstellung: Stunden je Tag stimmen in der Zeitzone der Einstellungen, die Summe bleibt gleich (Task 2).
- Zeitraum Quartal oder laufender Monat: Block 3 und 4 zeigen den letzten Monat des Zeitraums, bei laufendem Monat nur bis jetzt (Task 2).
- Zeitraumwechsel im Gruppentab behält die gewählte Gruppe (Task 4).
- `view=groups` ohne Gruppe wählt die schwächste, ungültige Gruppe liefert den bekannten Fehlertext, eine Installation ohne Gruppen zeigt einen Hinweis statt einer leeren Seite (Task 3, 6).

## Abweichungen vom Konzept (Frank bei der Abnahme nennen)

1. Adressparameter `view=groups&group=<id>` statt `ansicht=gruppen&gruppe=<id>`, damit sie zu den vorhandenen englischen Namen passen. Task 7 passt das Konzept an.
2. Block 4 (je Tag) zeigt nur Teilausfall und Schwerer Ausfall. „Eingeschränkt“ steht nur in Block 3, weil `computeServiceMetrics` dafür keine Zeitabschnitte liefert, nur eine Summe.
3. Block 3 erscheint, sobald ein Dienst im Monat Ausfall oder Einschränkung hatte. Block 4 erscheint nur, wenn mindestens ein Ausfall vorliegt.

## Dateien

| Datei | Aufgabe |
|---|---|
| `src/lib/report/heat.ts` (neu) | `heatClass` (aus `Heatmap.tsx` verschoben), `chunkRows` |
| `src/lib/report/group-sheet.ts` (neu) | Ausfälle je Tag und je Dienst für einen Monat |
| `src/lib/report/aggregate.ts` | `groupList` und `sheet` in `ReportData` |
| `src/lib/report/params.ts` | Parameter `view`, `reportHref` |
| `src/lib/report/load.ts` | Standardgruppe bei `view=groups` |
| `src/components/admin/availability-report/ViewTabs.tsx`, `GroupList.tsx` (neu) | Tabs, Gruppenliste |
| `.../GroupBars.tsx`, `DisruptionsByService.tsx`, `DisruptionsByDay.tsx`, `GroupSheet.tsx` (neu) | Blöcke 2 bis 4 und das ganze Blatt |
| `.../Heatmap.tsx`, `ReportControlsForm.tsx`, `ReportView.tsx`, `index.tsx`, `report.scss` | angepasst |
| `tests/unit/report-*.test.ts(x)`, `tests/e2e/availability-report.spec.ts` | Tests |

---

### Task 1: Wärmekarte in Blöcken zu 12 Zeilen

**Files:**
- Create: `src/lib/report/heat.ts`, `tests/unit/report-heat.test.ts`
- Modify: `src/components/admin/availability-report/Heatmap.tsx`, `tests/unit/report-view.test.tsx` (falls `heatClass` dort importiert wird)

**Interfaces:**
- Produces: `heatClass(value: number | null, target: number): 0 | 1 | 2 | 3 | 4` (Logik unverändert aus `Heatmap.tsx`), `chunkRows<T>(rows: T[], size?: number): T[][]` (Standard `size = 12`, leere Eingabe ergibt `[]`).

- [ ] **Step 1: Failing tests in `tests/unit/report-heat.test.ts`:** `chunkRows` mit 30 Elementen ergibt Blöcke der Längen `[12, 12, 6]`; mit 12 Elementen `[12]`; mit 0 Elementen `[]`; `heatClass(99.95, 99)` ist 1, `heatClass(99.6, 99)` ist 2, `heatClass(99.2, 99)` ist 3, `heatClass(98, 99)` ist 4, `heatClass(100, 99)` und `heatClass(null, 99)` sind 0.
- [ ] **Step 2:** `npx tsx --test tests/unit/report-heat.test.ts` — erwartet FAIL (Modul fehlt).
- [ ] **Step 3:** `src/lib/report/heat.ts` anlegen. `heatClass` aus `Heatmap.tsx` dorthin verschieben und dort importieren. In `Heatmap.tsx` die Zeilen mit `chunkRows(rest)` in Blöcke teilen: der erste Block steht sichtbar, jeder weitere in einem eigenen `<details>` mit der Zusammenfassung „Zeilen 13 bis 24“ (`ta`). Gesamtzeile bleibt oben im ersten Block.
- [ ] **Step 4:** `npm run test:unit` — erwartet alle PASS, `npx tsc --noEmit` ohne Fehler.
- [ ] **Step 5:** `git add src/lib/report/heat.ts tests/unit/report-heat.test.ts src/components/admin/availability-report/Heatmap.tsx` und `git commit -m "refactor(bericht): Teile Wärmekarte in 12er-Blöcke (#64)"`.

### Task 2: Ausfälle je Tag und je Dienst für einen Monat

**Files:**
- Create: `src/lib/report/group-sheet.ts`, `tests/unit/report-group-sheet.test.ts`

**Interfaces:**
- Consumes: `computeServiceMetrics` aus `@/lib/report/metrics` (liefert `outages`, `degradedMs`), `startOfZonedDay`, `addZonedDays`, `formatDateSlug` aus `@/lib/datetime`, `Timeline` aus `@/lib/availability`, `ReportPeriod` aus `@/lib/report/period`.
- Produces:
  - `splitOutageByDay(outage: { from: number; to: number }, timeZone: string): Array<{ day: string; ms: number }>` mit `day` als `YYYY-MM-DD` in der Zeitzone, aufsteigend, Summe der `ms` gleich `to - from`.
  - `type GroupSheetData = { month: { key: string; label: string }; perService: Array<{ serviceId: number; name: string; majorMs: number; partialMs: number; degradedMs: number }>; perDay: Array<{ day: string; dayOfMonth: number; bars: Array<{ serviceId: number; name: string; status: 'partial' | 'major'; ms: number }> }> }`
  - `buildGroupSheet(input: { month: ReportPeriod; services: Array<{ id: number; name: string; timeline: Timeline; windows: Array<{ from: number; to: number }> }>; mode: MaintenanceMode; timeZone: string }): GroupSheetData`
  - `perService` enthält nur Dienste mit `majorMs + partialMs + degradedMs > 0`, absteigend nach `majorMs + partialMs`, dann nach Name. `perDay` enthält jeden Tag des Monats (auch ohne Ausfall) von `month.start` bis `month.end`, `bars` absteigend nach `ms`.

- [ ] **Step 1: Failing tests in `tests/unit/report-group-sheet.test.ts`:**
  - `splitOutageByDay` für 24.10.2026 23:00 bis 25.10.2026 01:00 Ortszeit (`2026-10-24T21:00:00Z` bis `2026-10-24T23:00:00Z`, Zone `Europe/Berlin`) ergibt `[{ day: '2026-10-24', ms: 3_600_000 }, { day: '2026-10-25', ms: 3_600_000 }]`.
  - Ausfall über die Zeitumstellung (`2026-10-25T00:00:00Z` bis `2026-10-26T00:00:00Z`, Berlin): zwei Einträge, Summe 86 400 000, kein Eintrag mit negativem Wert.
  - Ausfall innerhalb eines Tages ergibt genau einen Eintrag.
  - `buildGroupSheet` mit einem Dienst, der von 12.10. 10:00 bis 12.10. 12:00 Teilausfall und von 13.10. 08:00 bis 13.10. 09:30 Schwerer Ausfall hatte: `perService[0]` hat `partialMs = 7_200_000`, `majorMs = 5_400_000`, `perDay` hat 31 Einträge, Tag 12 hat einen Balken `partial` mit `ms = 7_200_000`, Tag 13 einen Balken `major` mit `ms = 5_400_000`, alle übrigen Tage `bars: []`.
  - Zwei Dienste am selben Tag: `bars` ist absteigend nach `ms` sortiert.
  - Dienst nur mit Eingeschränkt: steht in `perService` (`degradedMs > 0`), `perDay` hat keine Balken.
  - Dienst ohne Störung fehlt in `perService`.
  - Laufender Monat (`month.end` = 14.10. 12:00): `perDay` endet mit Tag 14.
- [ ] **Step 2:** `npx tsx --test tests/unit/report-group-sheet.test.ts` — erwartet FAIL.
- [ ] **Step 3:** `group-sheet.ts` umsetzen. Je Dienst `computeServiceMetrics` über `month.start` bis `month.end` mit `mode`; jeden Ausfall mit `splitOutageByDay` auf Tage verteilen. Tage des Monats mit `startOfZonedDay` und `addZonedDays` erzeugen (nicht mit festen 24 Stunden).
- [ ] **Step 4:** Test erneut — erwartet PASS.
- [ ] **Step 5:** `git add src/lib/report/group-sheet.ts tests/unit/report-group-sheet.test.ts` und `git commit -m "feat(bericht): Berechne Ausfälle je Tag und Dienst (#64)"`.

### Task 3: Gruppenliste und Gruppenblatt in den Berichtsdaten

**Files:**
- Modify: `src/lib/report/aggregate.ts`, `src/lib/report/params.ts`, `src/lib/report/load.ts`, `tests/unit/report-aggregate.test.ts`, `tests/unit/report-params.test.ts`

**Interfaces:**
- Consumes: `buildGroupSheet`, `GroupSheetData` (Task 2), `heatClass` (Task 1).
- Produces:
  - `ReportParams.view: 'overall' | 'groups'` (Standard `overall`, nur `groups` wird erkannt).
  - `reportHref(search: Record<string, string | string[] | undefined>, overrides: Record<string, string | undefined>): string` in `params.ts`: baut `/admin/verfuegbarkeitsbericht?…` aus allen Parametern der Adresse, `overrides` ersetzt oder (bei `undefined`) entfernt einen Wert, Reihenfolge der Schlüssel alphabetisch.
  - `type GroupListEntry = { id: number; name: string; serviceCount: number; availability: number | null; target: number; level: 0 | 1 | 2 | 3 | 4 }` und `ReportData.groupList: GroupListEntry[]` und `ReportData.sheet: GroupSheetData | null`.
  - `groupList` enthält alle Gruppen mit mindestens einem Dienst, unabhängig von `params.group`. `availability` ist der Mittelwert der Dienstwerte (Rechenart wie `valueFor`), `level = heatClass(availability, target)`. Sortierung aufsteigend nach `availability`, `null` zuletzt, dann Name (`localeCompare(…, 'de')`).
  - `sheet` ist bei gewählter Gruppe `buildGroupSheet` für den letzten Eintrag von `periodMonths(period, …)` mit den Diensten der Gruppe, sonst `null`. Fehlt ein Monat, ist `sheet` `null`.
  - `loadReport`: ist `params.view === 'groups'` und `params.group` leer und `groupList` nicht leer, wird der Bericht mit `group = String(groupList[0].id)` neu gebaut (Fußnoten der Gruppe eingeschlossen). Dafür den Teil ab `countFootnotes` bis `buildReport` in eine lokale Funktion `build(group?: string)` ziehen.
  - `emptyData` liefert `groupList: []` und `sheet: null`.

- [ ] **Step 1: Failing tests.**
  - `report-params.test.ts`: `parseReportParams({ view: 'groups' }).view === 'groups'`; ohne `view` und mit `view: 'x'` ist es `'overall'`. `reportHref({ period: '2026-10', calc: 'monthly' }, { view: 'groups', group: '7' })` ergibt `/admin/verfuegbarkeitsbericht?calc=monthly&group=7&period=2026-10&view=groups`; `reportHref({ group: '7' }, { group: undefined })` ergibt `/admin/verfuegbarkeitsbericht`.
  - `report-aggregate.test.ts` (vorhandene Hilfen für Eingaben nutzen): `groupList` hat für drei Gruppen die erwartete Reihenfolge (Gruppe mit 98,1 % vor 99,05 % vor 100 %); eine Gruppe ohne bekannte Zustände steht zuletzt mit `availability: null` und `level: 0`; `groupList` ist bei `params.group = '<id>'` gleich lang wie ohne Gruppe; `sheet` ist ohne Gruppe `null`; mit Gruppe und Quartals-Zeitraum ist `sheet.month.key` der Schlüssel des dritten Monats; Gruppe mit einem Dienst liefert `groupList[i].serviceCount === 1` und ein `sheet`.
- [ ] **Step 2:** `npx tsx --test tests/unit/report-params.test.ts tests/unit/report-aggregate.test.ts` — erwartet FAIL.
- [ ] **Step 3:** Umsetzen wie in Interfaces beschrieben. `valueFor` aus `buildReport` für alle Dienste einmal je Gruppe verwenden, nicht neu erfinden.
- [ ] **Step 4:** `npm run test:unit` und `npx tsc --noEmit` — erwartet PASS.
- [ ] **Step 5:** `git add src/lib/report tests/unit/report-params.test.ts tests/unit/report-aggregate.test.ts` und `git commit -m "feat(bericht): Liefere Gruppenliste und Blatt (#64)"`.

### Task 4: Tabs, Gruppenliste und Auswahlfelder

**Files:**
- Create: `src/components/admin/availability-report/ViewTabs.tsx`, `GroupList.tsx`
- Modify: `ReportControlsForm.tsx`, `report.scss`, `tests/unit/report-view.test.tsx`

**Interfaces:**
- Consumes: `GroupListEntry`, `reportHref` (Task 3), `formatAvailability` aus `@/lib/availability`.
- Produces:
  - `ViewTabs(props: { active: 'overall' | 'groups'; hrefs: { overall: string; groups: string } })`: `<nav aria-label>` mit zwei Links „Gesamtbericht“ und „Gruppenberichte“, der aktive trägt `aria-current="page"`.
  - `GroupList(props: { groups: GroupListEntry[]; selectedId: number | null; hrefFor: (id: number) => string; locale: string })`: eine Liste mit `data-testid="group-list"`, je Gruppe ein Link mit Farbpunkt (Klasse `heat-<level>`), Name und Verfügbarkeit (`–` bei `null`), die gewählte mit `aria-current="true"`.
  - `ReportControlsFormProps` verliert `groups`. Das Formular enthält zusätzlich `<input type="hidden" name="view" value={params.view}>` und, nur wenn `params.view === 'groups' && params.group`, `<input type="hidden" name="group" value={params.group}>`. Das Auswahlfeld „Gruppe“ entfällt.

- [ ] **Step 1: Failing tests** in `tests/unit/report-view.test.tsx`: Formular mit `view: 'groups'`, `group: '7'` enthält `name="group" value="7"` und `name="view" value="groups"` und kein `<select name="group"`. Formular mit `view: 'overall'` und `group: '7'` enthält kein `name="group"`. `ViewTabs` mit `active: 'groups'` markiert nur den zweiten Link mit `aria-current`. `GroupList` mit drei Einträgen: Reihenfolge im Markup entspricht der Eingabe, gewählter Eintrag hat `aria-current`, `availability: null` zeigt `–`, Link enthält `hrefFor(id)`.
- [ ] **Step 2:** `npx tsx --test tests/unit/report-view.test.tsx` — erwartet FAIL.
- [ ] **Step 3:** Komponenten anlegen, Formular ändern, Stile in `report.scss` ergänzen (Tabs, Liste mit festen 260 px Breite und eigenem Scrollbereich, Farbpunkt nach `heat-*`).
- [ ] **Step 4:** `npm run test:unit`, `npx tsc --noEmit`, `npm run lint` — erwartet PASS.
- [ ] **Step 5:** `git add src/components/admin/availability-report tests/unit/report-view.test.tsx` und `git commit -m "feat(bericht): Füge Tabs und Gruppenliste hinzu (#64)"`.

### Task 5: Gruppenblatt mit den Blöcken 1 bis 5

**Files:**
- Create: `GroupBars.tsx`, `DisruptionsByService.tsx`, `DisruptionsByDay.tsx`, `GroupSheet.tsx` (alle unter `src/components/admin/availability-report/`), `tests/unit/report-group-sheet-view.test.tsx`
- Modify: `report.scss`

**Interfaces:**
- Consumes: `ReportData` (Task 3), `TrendChart`, `Heatmap` (vorhanden), `formatAvailability`.
- Produces:
  - `GroupBars(props: { rows: RankingRow[]; locale: string })` (Block 2): ein Balken je Dienst, Breite nach Verfügbarkeit, Farbe nach `heatClass`, Text `<Wert> · <Ausfalldauer>`; `data-testid="sheet-services"`.
  - `DisruptionsByService(props: { sheet: GroupSheetData })` (Block 3): gestapelter Balken je Dienst (Schwerer Ausfall, Teilausfall, Eingeschränkt) mit Legende; liefert `null`, wenn `perService` leer ist; `data-testid="sheet-by-service"`.
  - `DisruptionsByDay(props: { sheet: GroupSheetData })` (Block 4): SVG mit allen Tagen auf der Achse, je Tag mit Ausfall ein schmaler Balken je Dienst (Farbe nach Status), Dienstname senkrecht darunter, nur an Tagen mit Balken; liefert `null`, wenn kein Tag Balken hat; `data-testid="sheet-by-day"`.
  - `GroupSheet(props: { data: ReportData; locale: string })`: Titel „Gruppenblatt: <Name>“, Kopfzeile mit Verfügbarkeit, Ziel, Zahl der Dienste, Zeitraum; Block 1 `TrendChart` mit `data.trend`, Block 2, Block 3, Block 4, Block 5 `Heatmap` mit `data.heat`. Block 3 und 4 tragen den Monat in der Überschrift (`sheet.month.label`).

- [ ] **Step 1: Failing tests** in `tests/unit/report-group-sheet-view.test.tsx` (Daten wie in `report-view.test.tsx` aufbauen, mit `scope.groupName` gesetzt):
  - Blatt mit Ausfällen enthält `sheet-by-service` und `sheet-by-day`; je Balken genau ein `<rect` mit Klasse `availability-report__sev-major` oder `…-partial`; die Dienstnamen stehen im Markup (senkrechter Text mit `rotate(90`).
  - Blatt mit `sheet.perService = []` enthält weder `sheet-by-service` noch `sheet-by-day`.
  - Blatt, dessen einziger Dienst nur Eingeschränkt hatte: `sheet-by-service` ja, `sheet-by-day` nein.
  - Gruppe mit einem Dienst: Blatt rendert, `sheet-services` enthält genau eine Zeile.
  - `data.kpis.availability = null`: Blatt rendert mit `–`, kein Wurf.
  - Überschrift von Block 3 enthält `sheet.month.label`.
- [ ] **Step 2:** `npx tsx --test tests/unit/report-group-sheet-view.test.tsx` — erwartet FAIL.
- [ ] **Step 3:** Komponenten nach Interfaces. SVG-Maße wie in `TrendChart.tsx` (feste `viewBox`, `width: 100%`). Stunden auf der Achse in `ta('h', 'Std.')`; die höchsten Tage tragen die Summe als Beschriftung. Stile für `availability-report__sev-*` in `report.scss`.
- [ ] **Step 4:** `npm run test:unit`, `npx tsc --noEmit`, `npm run lint` — erwartet PASS.
- [ ] **Step 5:** `git add src/components/admin/availability-report tests/unit/report-group-sheet-view.test.tsx` und `git commit -m "feat(bericht): Zeige das Gruppenblatt (#64)"`.

### Task 6: Seite verdrahten, alte Gruppenansicht entfernen

**Files:**
- Modify: `src/components/admin/availability-report/index.tsx`, `ReportView.tsx`, `tests/unit/report-view.test.tsx`

**Interfaces:**
- Consumes: alle Komponenten und Funktionen der Tasks 1 bis 5, `reportHref`.
- Produces: `AvailabilityReportView` rendert: Überschrift, Auswahlfelder, `ViewTabs`, darunter je nach `params.view` den Gesamtbericht (`ReportView`) oder `GroupList` neben `GroupSheet`.

- [ ] **Step 1: Failing tests** in `tests/unit/report-view.test.tsx`: `ReportView` mit gesetztem `scope.groupName` zeigt die Überschrift „Wärmekarte nach Dienstgruppen“ und nie die Überschrift „Dienste der Gruppe“ (die Gruppenansicht ist entfernt). Die Spalte „Gruppe“ der Rangliste bleibt immer sichtbar.
- [ ] **Step 2:** `npx tsx --test tests/unit/report-view.test.tsx` — erwartet FAIL.
- [ ] **Step 3:** `ReportView.tsx`: die Zweige `data.scope.groupName` entfernen (Überschrift, `scopeText`, `showGroup`). `index.tsx`: `parseReportParams(search)` lesen. Bei `view=overall` den Parameter `group` vor `loadReport` entfernen (`{ ...search, group: undefined }`), damit der Gesamtbericht immer alle Gruppen zeigt. Bei `view=groups` `loadReport(search)` aufrufen, `GroupList` mit `hrefFor = (id) => reportHref(search, { view: 'groups', group: String(id) })` und `GroupSheet` rendern. Ist `groupList` leer, steht dort ein Hinweis „Keine Gruppen mit Diensten.“. `ViewTabs`-Links mit `reportHref(search, { view: 'overall', group: undefined })` und `reportHref(search, { view: 'groups' })`. Die Abfrage der Gruppen für das Auswahlfeld in `index.tsx` entfällt. `controls` bekommt `params` mit der aufgelösten Gruppe (`result.params.group` nach der Standardwahl in `loadReport`).
- [ ] **Step 4:** `npm run test:unit`, `npx tsc --noEmit`, `npm run lint`. Danach Dev-Server starten (`npm run dev` nach Projektanleitung) und `/admin/verfuegbarkeitsbericht?view=groups` im Browser ansehen: Tabs, Liste mit 36 Gruppen, Blatt der schwächsten Gruppe. Das prüft Frank im Browser, die E2E-Umgebung testet die Admin-Seite nicht.
- [ ] **Step 5:** `git add src/components/admin/availability-report tests/unit/report-view.test.tsx` und `git commit -m "feat(bericht): Verdrahte Tabs auf der Berichtsseite (#64)"`.

### Task 7: E2E-Tests, Handbuch und Konzept

**Files:**
- Modify: `tests/e2e/availability-report.spec.ts`, `docs/src/admin/availability-report.md`, `docs/superpowers/specs/2026-11-12-berichtsexport-design.md`

- [ ] **Step 1: Failing tests** in `tests/e2e/availability-report.spec.ts` (Route `/api/availability-report`):
  - Mit angelegter Gruppe und zwei Diensten: Antwort auf `period=<Monat>&view=groups` enthält `groupList` mit dieser Gruppe (`serviceCount === 2`), `scope.groupId` ist die `id` des ersten Eintrags von `groupList`, `sheet` ist nicht `null`, `sheet.perDay.length` ist mindestens 28.
  - `period=<Monat>&view=groups&group=99999999` ergibt Status 400.
  - `period=<Monat>` (ohne `view`) liefert `sheet === null` und `groupList` mit mindestens der angelegten Gruppe.
- [ ] **Step 2:** E2E-Befehl nach `docs/src/development/testing.md` ausführen — erwartet FAIL.
- [ ] **Step 3:** Prüfen, dass `src/app/api/availability-report/route.ts` die neuen Felder mit ausliefert (sie hängen an `ReportData`); sonst ergänzen. Handbuch: Abschnitte zu Tabs, Gruppenliste, Gruppenblatt (Block 1 bis 5), Hinweis „Block 3 und 4 zeigen den letzten Monat des Zeitraums“. Konzept Abschnitt 4: Adressparameter auf `view=groups&group=<id>` ändern und die Abweichungen 2 und 3 aus diesem Plan eintragen.
- [ ] **Step 4:** E2E erneut — erwartet PASS. `npm run test:unit` — PASS.
- [ ] **Step 5:** `git add tests/e2e docs` und `git commit -m "test(bericht): Prüfe Gruppenliste und Blatt (#64)"`, danach `git commit -m "docs(bericht): Beschreibe Tabs und Gruppenblatt (#64)"` für Handbuch und Konzept getrennt.

## Danach (nicht Teil dieses Plans)

Messung der Rechenzeit der Seite mit 166 Diensten auf Test (768 MiB) vor dem Image, weil `groupList` alle Dienste berechnet. Dann Plan für Export (#50) und Mailversand (#65).
