# Zielwert und nachgerechneter Verlauf: Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Statusprotokoll enthält den Verlauf je Dienst ab 05.05.2025 (aus Vorfällen nachgerechnet), der Gesamtzielwert 99 % ist als Einstellung vorhanden, und Lagebild und Bericht rechnen mit demselben Code.

**Architecture:** Reine Rechenfunktionen ohne Datenbankzugriff liegen in `src/lib/` und werden mit `tsx --test` geprüft (kein Browser, kein Server). Eine Schema-Migration legt Zielwertfelder und das Kennzeichen am Statusprotokoll an, eine zweite Migration füllt das Protokoll mit denselben reinen Funktionen. Das Lagebild importiert die verschobenen Funktionen aus der neuen Datei.

**Tech Stack:** TypeScript, Payload 3.90.2 (Postgres, Migrationen als SQL über `db.execute(sql…)`), `tsx` (bereits Dev-Abhängigkeit), `node:test`, Playwright (nur für den vorhandenen E2E-Lauf).

**Spec:** `docs/superpowers/specs/2026-11-11-verfuegbarkeitsbericht-design.md`, Abschnitte 4.1, 4.4, 4.6, 5 und 9. Issue #48 im Fork (GitHub). Folgeissues #49 (Berichtsseite) und #50 (Export) gehören nicht zu diesem Plan.

## Global Constraints

- Verfügbarkeit: Anteil der bekannten Zeit ohne `partial` und `major`; `degraded` und `maintenance` zählen als verfügbar (Konzept 4.1). Anzeige mit zwei Nachkommastellen, abgerundet.
- Gesamtzielwert **99** (Prozent). Reihenfolge: Komponente vor Gruppe vor Gesamt (Konzept 4.4). Gruppen- und Komponentenfeld ohne Eingabe im Admin.
- Das Feld `impact` der Vorfälle wird nicht geändert.
- Die Nachrechnung ist wiederholbar, behält die Startwerte vom 10.11.2026 und trägt ein Kennzeichen am Eintrag (Konzept 5.3).
- Ein Dienst gilt ab dem frühesten Vorfall (in Dev 05.05.2025 13:25 UTC) als bekannt (Konzept 5.4).
- Migrationen sind nicht umkehrbar im Betrieb: neue Enum-Typen in der Schema-Migration, Daten in einer eigenen zweiten Migration. `src/payload-types.ts` ist generiert (`npm run generate:types`).
- Branch `feature/48-zielwert-nachrechnung`. Commits `<typ>(<scope>): <Beschreibung> (#48)`, Imperativ, erste Zeile höchstens 50 Zeichen, Ende mit der Zeile `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Squash-Merge, PR-Body mit „Nicht Teil dieses PR“, kein `--fill`, `gh` immer mit `-R xalbrecht/yet-another-status-page`.
- Hinter dem Firmenproxy: für `npm install` und E2E gelten `E2E_CA_FILE` und die Hinweise in `docs/src/development/testing.md`.
- TypeScript-Dateien dieses Forks tragen keinen Dateikopf nach `datei-kopf-konvention` (die Konvention nennt TypeScript nicht). Neue Dateien folgen dem Stil der Nachbarn, Kommentare auf Deutsch.

## Review Focus

1. Vorfall noch offen (`resolved_at` leer): die Migration übergeht ihn, sein Zustand steht im Dienst selbst (Test in Task 5, Schritt 6).
2. Vorfall reicht über den Startwert des Dienstes (10.11.2026 15:56) hinaus: Einträge ab dem Startwert entfallen (Test in Task 4).
3. Dienst ohne Vorfall: nur der Anker „Betriebsbereit“ am 05.05.2025 (Test in Task 4).
4. Titel mit Großschreibung oder führendem Leerzeichen („ HINWEIS: …“) und Vorfall ohne Aktualisierungstext (Test in Task 3).
5. Zielwert 0 auf Gruppen- oder Komponentenebene ist ein gültiger Wert und fällt nicht auf die nächste Stufe durch (Test in Task 2).

---

### Task 1: Gemeinsame Rechenfunktionen (`src/lib/availability.ts`)

**Files:**
- Create: `src/lib/availability.ts`, `tests/unit/availability.test.ts`
- Modify: `src/lib/lagebild.ts` (Funktionen verschieben, Import und Re-Export), `package.json` (Skript `test:unit`), `docs/src/development/testing.md` (Abschnitt „What exists“: Satz „There is no unit test setup“ ersetzen)

**Interfaces:**
- Produces, alle aus `@/lib/availability`:
  - `type AvailabilityStatus = Service['status']` und `type Timeline = Array<{ at: number; status: AvailabilityStatus }>`
  - `statusAt(timeline, time): AvailabilityStatus | null`, `worstStatus(statuses): AvailabilityStatus | null`, `groupStatusAt(timelines, time)`, `computeAvailability(timeline, windowStart, now): number | null`, `knownSince(timeline, windowStart, now): number | null`, `formatAvailability(value: number | null, locale: string): string` (Verhalten unverändert zu `lagebild.ts`)
  - `computeStatusDurations(timeline, windowStart, now): { knownMs: number; byStatus: Record<AvailabilityStatus, number> }`
- `lagebild.ts` behält `LagebildStatus` als Alias auf `AvailabilityStatus` und exportiert die verschobenen Namen weiter, damit `src/components/status/lagebild/*` unverändert bleiben. `computePeriods` und `RawPeriod` bleiben in `lagebild.ts`.

- [ ] **Step 1: Skript anlegen.** `package.json`: `"test:unit": "tsx --test tests/unit/*.test.ts"`. Kein weiterer Testrunner.
- [ ] **Step 2: Test schreiben** in `tests/unit/availability.test.ts` mit `node:test` und `node:assert/strict`. Feste Eingaben: `H = 3600_000`, `t0 = Date.parse('2026-11-10T15:56:00Z')`. Fälle (Näherung mit Toleranz 1e-9):
  - `[operational@t0, partial@t0+10H, operational@t0+12H]`, Fenster `t0` bis `t0+24H`: `computeAvailability` ≈ 91.6666666667, `formatAvailability(…, 'de-DE')` = `'91,66 %'`
  - gleicher Verlauf, Fenster `t0-24H` bis `t0+24H`: gleicher Wert, `knownSince` = `t0`
  - `[]` und Fenster vor dem ersten Eintrag: `computeAvailability` = `null`, `formatAvailability(null, 'de-DE')` = `''`
  - `[op@t0, degraded@t0+1H, maintenance@t0+2H, op@t0+3H]`, Fenster `t0` bis `t0+4H`: `computeAvailability` = 100; `computeStatusDurations` = `{ knownMs: 4H, byStatus: { operational: 2H, degraded: 1H, maintenance: 1H, partial: 0, major: 0 } }`
  - `formatAvailability(99.996, 'de-DE')` = `'99,99 %'`
  - `worstStatus(['operational','maintenance','degraded'])` = `'degraded'`, `worstStatus([null, undefined])` = `null`, `worstStatus(['partial','major'])` = `'major'`
- [ ] **Step 3: Test laufen lassen.** `npm run test:unit` → FAIL (Modul fehlt).
- [ ] **Step 4: Verschieben.** Die genannten Funktionen und `SEVERITY` unverändert aus `src/lib/lagebild.ts` nach `src/lib/availability.ts` (nur `import type` aus `@/payload-types`, keine Laufzeit-Importe). `computeStatusDurations` neu schreiben: dieselbe Schleife wie `computeAvailability`, Summe je Status; `computeAvailability` bleibt wie es ist.
- [ ] **Step 5: Test laufen lassen.** `npm run test:unit` → PASS. Dazu `npm run typecheck` und `npm run lint` ohne neue Befunde.
- [ ] **Step 6: Lagebild unverändert prüfen.** E2E-Lauf `tests/e2e/lagebild.spec.ts` (Anleitung: `docs/src/development/testing.md`) → alle Tests bestanden.
- [ ] **Step 7: Commit.** `refactor(lagebild): Teile Rechenfunktionen (#48)`

### Task 2: Zielwert als Einstellung

**Files:**
- Modify: `src/lib/availability.ts`, `src/globals/Settings.ts`, `src/collections/ServiceGroups.ts`, `src/collections/Services.ts`, `src/lib/i18n/admin.ts`, `src/migrations/index.ts`, `src/payload-types.ts` (generiert)
- Create: `src/migrations/20261112_100000_add_availability_target_and_event_source.ts`, `tests/e2e/availability-target.spec.ts`
- Test: `tests/unit/availability.test.ts`

**Interfaces:**
- Produces: `DEFAULT_AVAILABILITY_TARGET = 99` und `resolveAvailabilityTarget(levels: { service?: number | null; group?: number | null; global?: number | null }): number` in `@/lib/availability`

- [ ] **Step 1: Test** in `tests/unit/availability.test.ts`: `resolveAvailabilityTarget({ global: 99 })` = 99; `({ group: 98, global: 99 })` = 98; `({ service: 99.9, group: 98, global: 99 })` = 99.9; `({ service: 0, group: 98, global: 99 })` = 0 (Review Focus 5); `({})` = 99.
- [ ] **Step 2: Fehlschlag prüfen.** `npm run test:unit` → FAIL.
- [ ] **Step 3: Funktion schreiben.** Erster Wert, der weder `null` noch `undefined` ist, in der Reihenfolge Komponente, Gruppe, Gesamt, sonst `DEFAULT_AVAILABILITY_TARGET`.
- [ ] **Step 4: Test laufen lassen.** → PASS.
- [ ] **Step 5: Felder.** `availabilityTarget` (Typ `number`, `min: 0`, `max: 100`): in `Settings.ts` mit `defaultValue: 99` und Beschriftung über `ta()` nahe `lagebildPeriodDays`; in `ServiceGroups.ts` und `Services.ts` optional ohne Standardwert mit `admin: { hidden: true }`. Deutsche Texte in `src/lib/i18n/admin.ts`: Beschriftung „Zielwert Verfügbarkeit (%)“, Beschreibung „Gilt für alle Dienste, bis eine Gruppe oder ein Dienst einen eigenen Wert hat.“
- [ ] **Step 6: Schema-Migration** `20261112_100000_add_availability_target_and_event_source.ts` nach dem Muster von `20261111_100000_add_subscriber_confirmation.ts`, in `src/migrations/index.ts` eintragen: `settings.availability_target numeric DEFAULT 99`, `service_groups.availability_target numeric`, `services.availability_target numeric`, Enum `enum_service_status_events_source` mit `'operation', 'reconstructed'`, Spalte `service_status_events.source` mit `DEFAULT 'operation' NOT NULL`. `down` entfernt Spalten und Typ.
- [ ] **Step 7: Feld `source`** in `src/collections/ServiceStatusEvents.ts`: Auswahlfeld mit den zwei Werten, `defaultValue: 'operation'`, `admin: { readOnly: true }`, `access: { create: () => false, update: () => false }` auf Feldebene. Titel „Quelle“.
- [ ] **Step 8: Typen erzeugen.** `npm run generate:types`; `npm run typecheck` → keine Fehler.
- [ ] **Step 9: E2E-Test** `tests/e2e/availability-target.spec.ts`: `GET /api/globals/settings` liefert `availabilityTarget === 99`; nach `updateSettings({ availabilityTarget: 99.5 })` liefert es 99.5; `afterAll` setzt 99 zurück. `updateSettings` aus `tests/utils/payload-helpers.ts`.
- [ ] **Step 10: Commit.** `feat(bericht): Ergänze Zielwert und Quelle (#48)`

### Task 3: Einordnung der Vorfälle (`src/lib/incident-classification.ts`)

**Files:**
- Create: `src/lib/incident-classification.ts`, `tests/unit/incident-classification.test.ts`

**Interfaces:**
- Produces: `type IncidentClass = { status: 'maintenance' | 'none' | 'degraded' | 'major' | 'partial'; sure: boolean }`
- Produces: `classifyIncident(input: { title: string; messages: string[] }): IncidentClass`
- Produces: `summarizeClassification(incidents: Array<{ title: string; messages: string[]; serviceCount: number }>): { unsure: number; withoutService: number }`

Regeln in dieser Reihenfolge (Konzept 5.1), Titel ohne führende Leerzeichen, ohne Beachtung der Groß-/Kleinschreibung:
1. Titel enthält `wartung` → `maintenance`, `sure: true`
2. Titel beginnt mit `hinweis` → `none`, `sure: true`
3. Text aller Aktualisierungen enthält `performance`, `ladezeit`, `wartezeit`, `langsam`, `verzögerung` oder `verzögert` → `degraded`, `sure: true` (nicht `leistungsniveau`)
4. Titel beginnt mit `vollständiger serviceausfall` → `major`, `sure: true`
5. Titel beginnt mit `teilweiser ausfall` → `partial`, `sure: true`
6. sonst `partial`, `sure: false`

- [ ] **Step 1: Test schreiben** (Name und Eingaben aus Dev, Erwartung als Code):
  - `'Nichtverfügbarkeit des Services TeVIS aufgrund von Wartungsarbeiten'` mit Text „Performance“ → `{ maintenance, true }`
  - `'Hinweis: Abruf der Lichtbilder aus der Fotocloud von e-passtransfer'` → `{ none, true }`; `' HINWEIS: Test'` mit `messages: []` → `{ none, true }` (Review Focus 4)
  - `'Erstmeldung - teilweiser Ausfall des Services Nova AVA'` mit Text „Aktuell kann es in NOVA AVA zu Performanceproblemen, d.h. längeren Wartezeiten … kommen“ → `{ degraded, true }`
  - `'Vollständiger Serviceausfall von Advis'` mit Text „… Performance …“ → `{ degraded, true }` (Entscheidung von Frank, 11.11.2026)
  - `'Vollständiger Serviceausfall Exchange'` mit Text ohne Stichwort → `{ major, true }`
  - `'Teilweiser Ausfall des Services beBPo'` → `{ partial, true }`
  - `'Störung Autista - Analysephase'` mit Text „Unser Team arbeitet an der Wiederherstellung des gewohnten Leistungsniveaus.“ → `{ partial, false }`
  - `summarizeClassification` über `[{ title: 'Störung Autista - Analysephase', messages: [], serviceCount: 1 }, { title: 'Nichtverfügbarkeit … Wartungsarbeiten', messages: [], serviceCount: 0 }, { title: 'Hinweis: Test', messages: [], serviceCount: 0 }]` → `{ unsure: 1, withoutService: 2 }`
- [ ] **Step 2: Fehlschlag prüfen.** `npm run test:unit` → FAIL.
- [ ] **Step 3: Implementieren.** Regeln als Liste in der oben genannten Reihenfolge; `summarizeClassification` zählt `sure === false` und `serviceCount === 0`.
- [ ] **Step 4: Test laufen lassen.** → PASS.
- [ ] **Step 5: Commit.** `feat(bericht): Ordne Vorfälle ein (#48)`

### Task 4: Nachrechnung als reine Funktion (`src/lib/status-reconstruction.ts`)

**Files:**
- Create: `src/lib/status-reconstruction.ts`, `tests/unit/status-reconstruction.test.ts`

**Interfaces:**
- Consumes: `AvailabilityStatus`, `worstStatus` aus `@/lib/availability`
- Produces: `buildReconstructedEvents(input: { anchorAt: number; services: Array<{ id: number; firstEventAt: number | null }>; incidents: Array<{ serviceIds: number[]; from: number; to: number; status: Exclude<AvailabilityStatus, 'operational'> }> }): Array<{ serviceId: number; at: number; status: AvailabilityStatus }>`, sortiert nach Dienst und Zeit

Regeln: Jeder Dienst erhält am `anchorAt` den Zustand `operational`. Je Dienst zählt an jedem Zeitpunkt der schlechteste Zustand der laufenden Vorfälle (`worstStatus`), sonst `operational`. Es entsteht ein Eintrag nur, wenn sich der Zustand ändert. Vorfälle mit `to <= from` entfallen, doppelte Dienste in `serviceIds` zählen einmal. Einträge mit `at >= firstEventAt` des Dienstes entfallen.

- [ ] **Step 1: Test schreiben.** `A = Date.parse('2025-05-05T13:25:00Z')`, `F = Date.parse('2026-11-10T15:56:00Z')`, `H = 3600_000`, Dienste 1 und 2 mit `firstEventAt: F`:
  - ohne Vorfälle: genau `[{1, A, operational}, {2, A, operational}]` (Review Focus 3)
  - ein Vorfall `partial` auf Dienst 1 von `A+10H` bis `A+12H`: Dienst 1 hat `A operational`, `A+10H partial`, `A+12H operational`; Dienst 2 nur den Anker
  - `partial` `A+10H` bis `A+14H` und `major` `A+12H` bis `A+13H`: `A op`, `10H partial`, `12H major`, `13H partial`, `14H op`
  - zwei `partial` hintereinander (`10H`–`12H`, `12H`–`14H`): `10H partial`, `14H op` (zusammengefasst)
  - `degraded` und `maintenance` überlappend: `degraded` gilt
  - `from === to`: nur der Anker
  - Vorfall von `F-1H` bis `F+5H` `partial`: `A op`, `F-1H partial`, kein Eintrag ab `F` (Review Focus 2)
  - `serviceIds: [1, 1]`: keine doppelten Einträge
- [ ] **Step 2: Fehlschlag prüfen.** `npm run test:unit` → FAIL.
- [ ] **Step 3: Implementieren.** Je Dienst alle Grenzzeitpunkte sammeln, aufsteigend durchgehen, Zustand mit `worstStatus` bestimmen.
- [ ] **Step 4: Test laufen lassen.** → PASS.
- [ ] **Step 5: Commit.** `feat(bericht): Berechne nachgerechneten Verlauf (#48)`

### Task 5: Migration zur Nachrechnung

**Files:**
- Create: `src/migrations/20261112_100100_backfill_status_events.ts`
- Modify: `src/migrations/index.ts`

**Interfaces:**
- Consumes: `classifyIncident` (Task 3), `buildReconstructedEvents` (Task 4), Spalte `service_status_events.source` (Task 2). Importe relativ (`../lib/…`), nicht über `@/`.
- Produces: Zeilen mit `source = 'reconstructed'`, die vor dem jeweils frühesten Eintrag mit `source = 'operation'` des Dienstes liegen.

- [ ] **Step 1: Migration schreiben.** `up({ db })`: alle Vorfälle lesen, die gelöst sind (`resolved_at IS NOT NULL`): `id`, `title`, `created_at`, `resolved_at` in Millisekunden, Dienste aus `incidents_rels` mit `path = 'affectedServices'`, Texte aus `incidents_updates.message` (nach `_order`). Je Vorfall `classifyIncident`; Vorfälle mit `status: 'none'` entfallen. `anchorAt` ist der früheste `created_at` aller gelesenen Vorfälle. Je Dienst das früheste `changed_at` mit `source = 'operation'` lesen. Zuerst alle Zeilen mit `source = 'reconstructed'` löschen, dann die Ergebnisse von `buildReconstructedEvents` einfügen. `down`: Zeilen mit `source = 'reconstructed'` löschen.
- [ ] **Step 2: Eintragen** in `src/migrations/index.ts` hinter der Schema-Migration.
- [ ] **Step 3: Kopie von Dev vorbereiten.** Datenbank `yasp-db` auf LISSREM oder lokal sichern und in eine Probedatenbank einspielen (`pg_dump` und `psql`), Anwendung gegen diese Datenbank starten. Die echte Dev-Datenbank bleibt unberührt.
- [ ] **Step 4: Migrationen laufen lassen** (`/admin` aufrufen oder `npx payload migrate`). Erwartung in Dev (Stand 11.11.2026): Einordnung der 165 Vorfälle = 17 `maintenance`, 3 `none`, 16 `degraded`, 20 `major`, 31 `partial` sicher, 78 `partial` nicht eindeutig. Die Zahl 89 im Konzept (Abschnitt 5.2) ist die Zahl vor Regel 3; Fußnote bei der Berichtsseite also „78“.
- [ ] **Step 5: Ergebnis prüfen** mit SQL auf der Kopie: jeder der 166 Dienste hat als frühesten `reconstructed`-Eintrag `operational` am `2025-05-05 13:25:00+00`; kein `reconstructed`-Eintrag liegt am oder nach dem frühesten `operation`-Eintrag desselben Dienstes; die 166 Startwerte vom 10.11.2026 15:56 sind unverändert vorhanden mit `source = 'operation'`.
- [ ] **Step 6: Randfälle auf der Kopie.** (a) Einen offenen Vorfall mit Dienst anlegen, `up` erneut ausführen: er erzeugt keinen Eintrag (Review Focus 1). (b) `up` ein zweites Mal ausführen: Anzahl der `reconstructed`-Zeilen bleibt gleich (Wiederholbarkeit).
- [ ] **Step 7: Lagebild ansehen** (Rückschau 365 Tage, Lagebild-Variante „Beide“): Verfügbarkeit je Dienst steht ohne den Zusatz „seit …“; Zeiträume des Jahres erscheinen in der Liste.
- [ ] **Step 8: Commit.** `feat(bericht): Rechne Statusprotokoll nach (#48)`

### Task 6: Gesamtprüfung und PR

**Files:**
- Modify: `docs/src/development/testing.md` (Zeile zu `test:unit` und den neuen E2E-Test)

- [ ] **Step 1:** `npm run test:unit`, `npm run typecheck`, `npm run lint` → alles grün.
- [ ] **Step 2:** Gesamter E2E-Lauf (`npm run test:e2e` mit `E2E_CA_FILE`) → bisher 98 bestanden, 2 übersprungen; jetzt zusätzlich der Test aus Task 2, 0 Fehlschläge.
- [ ] **Step 3:** PR `feat(bericht): Ergänze Zielwert und Nachrechnung (#48)` gegen `main`. Beschreibung mit Abschnitten Kontext, Änderungen, Prüfung (Zahlen aus Task 5, Schritt 4 und 5) und „Nicht Teil dieses PR“ (Berichtsseite #49, Export #50, Eingabe von Gruppen- und Komponentenzielwert, Zielwert im Lagebild, Abgleich der Einordnung mit Prod vor dem Einspielen dort). `Closes #48` im Squash-Text.
- [ ] **Step 4:** Nach dem Merge Image bauen und auf Dev ausliefern (Ablauf im Deployment-Projekt `yasp.io`, `bauen.sh`). Die Migration läuft beim ersten Aufruf von `/admin` und ist nicht umkehrbar. Rückweg: voriges Image `2026-11-11b`, Datenbank aus der Sicherung (`--sichern`).
