# Wartungsvorfälle umwandeln und Nachrechnung wiederholbar machen: Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die 17 als Störungen übernommenen Wartungen werden zu Wartungen, die Nachrechnung des Statusprotokolls lässt sich aus dem Admin jederzeit wiederholen, und eine Einordnung von Hand am Vorfall hat dabei Vorrang.

**Architecture:** Die Einordnung bekommt ein Feld am Vorfall. Die Nachrechnung und die Umwandlung liegen als Funktionen in `src/lib/`. Zwei Routen (nur für angemeldete Nutzer) und eine Admin-Seite „Statusprotokoll pflegen“ lösen sie mit Vorschau aus. Ein Befehl `npm run …` entfällt, weil das Container-Image (Next-Standalone, ohne `tsx` und ohne `scripts/`) keine Skripte ausführen kann.

**Tech Stack:** TypeScript, Payload 3.90.2 (Local API, `db.execute(sql…)`), `tsx --test`, Playwright (nur Routen).

**Spec:** `docs/superpowers/specs/2026-11-11-verfuegbarkeitsbericht-design.md`, Abschnitte 4.8 und 5; Ist-Stand `docs/superpowers/specs/2026-11-12-stoerung-benachrichtigung-wartung-ist-stand.md`, Abschnitte 2.7 und 5. Issue #57 im Fork (GitHub).

## Global Constraints

- Die Migration `20261112_100100_backfill_status_events` bleibt unverändert (ausgeliefert, nicht mehr änderbar). Neue Schemaänderungen kommen als neue Migration.
- Einordnung am Vorfall: Automatisch (Standard), Keine Auswirkung, Eingeschränkt, Teilausfall, Schwerer Ausfall. „Wartung“ gehört nicht zur Auswahl. Ein Wert außer „Automatisch“ gilt immer und zählt als eindeutig.
- Das Feld `impact` der Vorfälle wird nicht gelesen und nicht geändert.
- Umwandlung je Wartungsvorfall: Titel und betroffene Dienste wie am Vorfall; `scheduledStartAt` = Beginn des Vorfalls; `scheduledEndAt` und `completedAt` = `resolvedAt`; Status `completed`; Aktualisierungen mit Zeiten übernommen (Status „Behoben“ wird `completed`, alle anderen `in_progress`); Beschreibung „Übernommen aus Störung <Kurz-ID> (Vorgängerverfahren)“. Keine Benachrichtigungsentwürfe. Offene Vorfälle werden nicht umgewandelt.
- Nachrechnung: löscht nur Zeilen mit `source = 'reconstructed'`, die Betriebseinträge bleiben unverändert.
- Zugriff: angemeldete Nutzer. Im Testmodus (`PAYLOAD_PUBLIC_ALLOW_WRITES=true`) offen wie die übrigen Routen (`isTestMode` aus `src/lib/access.ts`).
- Beide Routen sind standardmäßig Vorschau (`dryRun: true`). Geschrieben wird nur bei `dryRun: false`.
- Branch `feature/57-umwandlung-nachrechnung`. Commits `<typ>(<scope>): <Beschreibung> (#57)`, Imperativ, erste Zeile höchstens 50 Zeichen, Ende mit `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Squash-Merge, PR-Body mit „Nicht Teil dieses PR“, kein `--fill`, `gh` immer mit `-R xalbrecht/yet-another-status-page`.
- Das Admin-Panel wird in der E2E-Umgebung nicht getestet. Die Admin-Seite wird über reine Komponenten (`renderToStaticMarkup`) geprüft, die Routen per E2E, die Seite selbst von Hand auf Dev.
- TypeScript-Dateien dieses Forks tragen keinen Dateikopf. Sicherung vor dem ersten Lauf auf Dev (`--sichern`).

## Review Focus

1. Ein Wartungsvorfall, der noch offen ist: wird nicht umgewandelt und in der Vorschau als „übersprungen (offen)“ gelistet (Test in Task 3).
2. Zweiter Lauf der Umwandlung: findet nichts mehr, erzeugt keine Dopplung (Test in Task 3).
3. Ein Vorfall mit „Wartung“ im Titel und einer Einordnung von Hand ungleich „Automatisch“: wird nicht umgewandelt, die Entscheidung von Hand gilt (Test in Task 3).
4. Wiederholungslauf der Nachrechnung behält die Einordnung von Hand und lässt die Betriebseinträge unverändert (Test in Task 1 und 2).
5. Zugriff ohne Anmeldung ist bei beiden Routen gesperrt (Prüfung von Hand mit `PAYLOAD_PUBLIC_ALLOW_WRITES=false`, Task 5).

---

### Task 1: Einordnung am Vorfall

**Files:** Modify `src/collections/Incidents.ts`, `src/lib/incident-classification.ts`, `src/lib/i18n/admin.ts`, `src/migrations/index.ts`, `src/payload-types.ts` (generiert); Create `src/migrations/20261112_200000_add_incident_availability_class.ts`; Test `tests/unit/incident-classification.test.ts`.

**Interfaces:**
- Produces: `classifyIncident(input: { title: string; messages: string[]; availabilityClass?: string | null }): IncidentClass`. Ist `availabilityClass` gesetzt und nicht `'auto'`, ist das Ergebnis `{ status: <Wert, 'none' bleibt 'none'>, sure: true }`, Titel und Text zählen dann nicht.
- Produces: Feld `incidents.availabilityClass` (Auswahl `auto | none | degraded | partial | major`, Standard `auto`).

- [ ] **Step 1: Test** in `tests/unit/incident-classification.test.ts`: `availabilityClass: 'major'` bei Titel „Störung Autista - Analysephase“ → `{ major, true }`; `'none'` bei Titel „Vollständiger Serviceausfall X“ → `{ none, true }`; `'auto'` und `undefined` verhalten sich wie bisher; `'degraded'` gewinnt gegen „Wartung“ im Titel (Review Focus 3 und 4); `summarizeClassification` zählt Vorfälle mit Einordnung von Hand nicht als unsicher.
- [ ] **Step 2:** `npm run test:unit` → FAIL. **Step 3:** Parameter ergänzen, `summarizeClassification` reicht ihn durch. **Step 4:** → PASS.
- [ ] **Step 5: Feld und Migration.** Auswahlfeld in `Incidents.ts` (Seitenleiste, Beschreibung „Gilt für die Nachrechnung des Verfügbarkeitsverlaufs vor dem 10.11.2026. Automatisch bewertet Titel und Text.“, deutsche Texte über `ta()`), Schema-Migration `20261112_200000_add_incident_availability_class` (Typ `enum_incidents_availability_class`, Spalte `availability_class` mit `DEFAULT 'auto' NOT NULL`, `down` entfernt beides), eintragen in `src/migrations/index.ts`, `npm run generate:types`, `npm run typecheck` und `npm run lint`.
- [ ] **Step 6: Commit** `feat(bericht): Ergänze Einordnung am Vorfall (#57)`

### Task 2: Nachrechnung wiederholbar (`src/lib/status-log-rebuild.ts`)

**Files:** Create `src/lib/status-log-rebuild.ts`, `src/app/api/status-log/rebuild/route.ts`, `tests/e2e/status-log-rebuild.spec.ts`.

**Interfaces:**
- Consumes: `classifyIncident` (Task 1), `buildReconstructedEvents` aus `@/lib/status-reconstruction`
- Produces: `type SqlRunner = { execute: (query: SQL) => Promise<{ rows: unknown[] }> }` und `type RebuildResult = { dryRun: boolean; incidents: number; counts: Record<string, number>; reconstructedBefore: number; reconstructedAfter: number; unsure: number; withoutService: number }` und `rebuildStatusLog(db: SqlRunner, options: { dryRun: boolean }): Promise<RebuildResult>`. Die Lese- und Schreibschritte entsprechen der Migration `20261112_100100`, zusätzlich wird `incidents.availability_class` gelesen und an `classifyIncident` gegeben. Bei `dryRun: true` wird nichts geschrieben. Aufruf aus der Route mit `payload.db.drizzle`.
- Produces: `POST /api/status-log/rebuild` mit `{ dryRun?: boolean }` (Standard `true`), Antwort das Ergebnis als JSON, ohne Anmeldung 401.

- [ ] **Step 1: E2E-Test** `tests/e2e/status-log-rebuild.spec.ts`: legt über die API Gruppe, Dienst und einen gelösten Vorfall „Störung Rebuild <id> - Analysephase“ an; `POST` mit Standard liefert `dryRun: true` und `reconstructedAfter` größer als 0, danach ist die Zahl der Zeilen mit Quelle `reconstructed` über `GET /api/service-status-events?where[source][equals]=reconstructed&limit=0` unverändert; `POST` mit `{ dryRun: false }` schreibt, die Zahl der Betriebszeilen (`source = operation`) bleibt gleich; ein zweiter Lauf liefert dieselbe Zahl (Review Focus 4). Der Vorfall mit `availabilityClass: 'major'` wird in `counts.major` gezählt.
- [ ] **Step 2:** Gegen die Docker-Umgebung (`docs/src/development/testing.md`, `E2E_CA_FILE`) → FAIL (Route fehlt). **Step 3:** `rebuildStatusLog` und Route implementieren. **Step 4:** → PASS, `npm run test:unit` und `npm run typecheck` grün.
- [ ] **Step 5: Commit** `feat(bericht): Mache die Nachrechnung wiederholbar (#57)`

### Task 3: Umwandlung der Wartungsvorfälle (`src/lib/maintenance-conversion.ts`)

**Files:** Create `src/lib/maintenance-conversion.ts`, `src/app/api/status-log/convert-maintenance/route.ts`, `tests/unit/maintenance-conversion.test.ts`, `tests/e2e/maintenance-conversion.spec.ts`.

**Interfaces:**
- Consumes: `classifyIncident` (Task 1), `rebuildStatusLog` (Task 2)
- Produces: `planMaintenanceFromIncident(incident: { id: number | string; title: string; shortId: string | null; resolvedAt: string | null; createdAt: string; availabilityClass?: string | null; serviceIds: Array<number | string>; updates: Array<{ status: string; message: string; createdAt: string }> }): { skip: 'open' | 'manual' | 'not-maintenance' } | { maintenance: MaintenanceDraft }`, wobei `MaintenanceDraft` die Felder aus den Global Constraints trägt (`title`, `affectedServices`, `scheduledStartAt`, `scheduledEndAt`, `completedAt`, `status: 'completed'`, `description`, `updates`).
- Produces: `type ConversionResult = { dryRun: boolean; converted: Array<{ incidentId: string; title: string; services: number; from: string; to: string }>; skipped: Array<{ incidentId: string; title: string; reason: string }>; rebuild?: RebuildResult }` und `convertMaintenanceIncidents(payload: Payload, options: { dryRun: boolean }): Promise<ConversionResult>`. Bei `dryRun: false`: je Vorfall Wartung per Local API anlegen (`context: { skipNotificationCreation: true, skipAutoStatusUpdate: true }`), dann den Vorfall löschen, zum Schluss `rebuildStatusLog(…, { dryRun: false })`.
- Produces: `POST /api/status-log/convert-maintenance` mit `{ dryRun?: boolean }` (Standard `true`).

- [ ] **Step 1: Unit-Test** `tests/unit/maintenance-conversion.test.ts` für `planMaintenanceFromIncident`: Vorfall „Nichtverfügbarkeit des Services TeVIS aufgrund von Wartungsarbeiten“, aufgelöst, zwei Aktualisierungen (investigating, resolved) → Entwurf mit `scheduledStartAt` = Beginn, `scheduledEndAt` = `completedAt` = `resolvedAt`, `status: 'completed'`, Aktualisierungen `in_progress` und `completed` mit gleichen Zeiten und Texten, Beschreibung „Übernommen aus Störung abc123 (Vorgängerverfahren)“; offener Vorfall → `{ skip: 'open' }` (Review Focus 1); Vorfall „Wartung“ mit `availabilityClass: 'partial'` → `{ skip: 'manual' }` (Review Focus 3); Titel ohne „Wartung“ → `{ skip: 'not-maintenance' }`.
- [ ] **Step 2:** `npm run test:unit` → FAIL. **Step 3:** Funktion implementieren. **Step 4:** → PASS.
- [ ] **Step 5: E2E-Test** `tests/e2e/maintenance-conversion.spec.ts`: legt einen gelösten Vorfall „Nichtverfügbarkeit des Services <Name> aufgrund von Wartungsarbeiten <id>“ mit einem Dienst an; `POST` ohne Angabe (Vorschau) listet ihn unter `converted`, ändert nichts (Vorfall besteht, keine Wartung); `POST { dryRun: false }` legt die Wartung an (`GET /api/maintenances?where[title][equals]=…`, Status `completed`, `completedAt` = Zeitpunkt „Behoben“), der Vorfall ist gelöscht, es gibt **keine** Benachrichtigung mit `relatedMaintenance` dieser Wartung; ein zweiter Lauf listet ihn nicht mehr und erzeugt keine zweite Wartung (Review Focus 2).
- [ ] **Step 6:** E2E → FAIL (Route fehlt), `convertMaintenanceIncidents` und Route implementieren, → PASS. **Step 7: Commit** `feat(bericht): Wandle Wartungsvorfälle um (#57)`

### Task 4: Admin-Seite „Statusprotokoll pflegen“

**Files:** Create `src/components/admin/status-log/StatusLogView.tsx`, `StatusLogActions.tsx`, `index.tsx`, `status-log.scss`, `StatusLogNavLink.tsx`, `tests/unit/status-log-view.test.tsx`; Modify `payload.config.ts`, `src/lib/i18n/admin.ts`, `package.json` (Skript `test:unit` um `tests/unit/*.test.tsx` erweitern), `src/app/(payload)/admin/importMap.js` (generiert).

**Interfaces:**
- Produces: `StatusLogView(props: { rebuild: RebuildResult | null; conversion: ConversionResult | null; busy: boolean })` als reine Komponente (zwei Abschnitte „Nachrechnung“ und „Wartungen aus Störungen“, je Schaltfläche „Vorschau“ und „Ausführen“, Tabelle der Vorfälle mit Grund bei übersprungenen); `StatusLogActions` (Client-Komponente) ruft die zwei Routen auf, „Ausführen“ erst nach Vorschau und einer Bestätigung im Dialog; Ansicht unter `/admin/protokoll-pflege`, Menüpunkt „Statusprotokoll pflegen“.

- [ ] **Step 1: Test** `tests/unit/status-log-view.test.tsx` (`renderToStaticMarkup`): zeigt Zahlen der Vorschau (`counts`, `unsure`, `withoutService`), die Liste der umzuwandelnden Vorfälle mit Titel, Zeitraum und Dienstanzahl, die übersprungenen mit Grund, „Ausführen“ nur nach einer Vorschau aktivierbar (Attribut `disabled` ohne Vorschau), keine Ausgabe von Fremdtext ungefiltert (Titel mit `<script>` erscheint maskiert).
- [ ] **Step 2:** `npm run test:unit` → FAIL. **Step 3:** Komponenten bauen, Texte über `ta()` mit deutschen Übersetzungen, Ansicht und Menüpunkt in `payload.config.ts` eintragen (`admin.components.views` und `afterNavLinks`), `npm run generate:importmap`. **Step 4:** `npm run test:unit`, `npm run typecheck`, `npm run lint` → grün.
- [ ] **Step 5: Commit** `feat(bericht): Ergänze Admin-Seite Statusprotokoll (#57)`

### Task 5: Handprüfung, Auftrag, Dokumentation und PR

**Files:** Create `docs/src/admin/status-log-maintenance.md`; Modify `docs/src/SUMMARY.md`, `docs/src/development/testing.md`.

- [ ] **Step 1: Dokumentation** der Seite auf Englisch im Stil von `docs/src/admin/situation-overview.md` (Vorschau, Ausführen, was sich ändert, Sicherung vorher), Eintrag in `SUMMARY.md`, Tests in `testing.md` ergänzen.
- [ ] **Step 2: Gesamtlauf** `npm run test:unit`, `npm run typecheck`, `npm run lint`, gesamter E2E-Lauf (`E2E_CA_FILE`) → keine Fehlschläge. Zugriff ohne Anmeldung: Umgebung mit `PAYLOAD_PUBLIC_ALLOW_WRITES=false`, beide Routen → 401 (Review Focus 5).
- [ ] **Step 3: Probelauf an einer Kopie der Dev-Datenbank** (wie bei Issue #48): Migration `20261112_200000` ausführen, Vorschau der Umwandlung prüfen (17 Vorfälle, alle gelöst), Ausführen, danach 17 Wartungen mit Status „Abgeschlossen“, keine Wartungsvorfälle mehr, keine neuen Benachrichtigungsentwürfe, Nachrechnung zählt 0 Einträge mit Zustand „Wartung“ aus diesen Vorfällen.
- [ ] **Step 4: Auftrag für die Sitzung in `~/projects/yasp.io`** als Text in die PR-Beschreibung: „`migration/mapping.py`: Vorfälle aus Cachet mit „Wartung“ im Titel als Wartungen anlegen (Felder wie in Abschnitt Global Constraints dieses Plans), damit ein Import auf Prod gleich richtig entsteht.“
- [ ] **Step 5: PR** `feat(bericht): Wandle Wartungen um und wiederhole die Nachrechnung (#57)`; Beschreibung mit Kontext, Änderungen, Prüfung und „Nicht Teil dieses PR“ (Berichtsseite #49, Verlauf der Auswirkung, Neuberechnung mit Vorschau, Sperren der Handänderung, Anpassung `yasp.io`). `Closes #57` im Squash-Text. Ausliefern auf Dev ist Franks Schritt: Sicherung, Image, danach auf `/admin/protokoll-pflege` die Vorschau ansehen und ausführen.
