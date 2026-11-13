# Statusseite mit Boxen und drei Darstellungen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Statusseite zeigt in den Varianten A und B das Lagebild links und rechts zwei Kurzform-Boxen (Störungen, Wartungen), mit Kachel „Alle“ und Tooltip an den Gruppen. Variante C (heutiger Wert `off`) bleibt die unveränderte einfache Seite.

**Architecture:** Reine Funktionen in `src/lib/status-boxes.ts` bereiten Boxeinträge und Admin-Werte auf. Die Server-Seite `page.tsx` lädt Störungen und Wartungen, wählt je Variante das Layout und reicht die Einstellungen durch. `Lagebild.tsx` bekommt die Kachel „Alle“ und den Tooltip. Drei neue Felder in den Website-Einstellungen steuern Kurzform, Anzahl und Lage der Boxen.

**Tech Stack:** Next.js (App Router, Server Components), Payload CMS 3 (Global `settings`, Postgres-Migration), Tailwind, `node:test` mit `tsx`, Playwright.

**Spec:** Design-Notiz im Issue #73 im Fork (GitHub): https://github.com/xalbrecht/yet-another-status-page/issues/73#issuecomment-6856849713. Mockup (abgenommen am 13.11.2026): `https://yasp-test.intra.kommunale.it:8443/_edge/statusseite-mockup.html`, Anleitung als PDF daneben. Beides liegt außerhalb des Repos, die Notiz im Issue ist maßgeblich.

## Global Constraints

- Branch `feature/73-statusseite-boxen` von `main`, nie direkt auf `main`. Commit `<typ>(<scope>): <Imperativ> (#73)`, erste Zeile höchstens 50 Zeichen, Anhang `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Gespeicherte Werte von `lagebildVariant` bleiben `off`, `a`, `b`, `both`. Keine Migration dafür, nur neue Beschriftungen. `off` heißt „Variante C (einfache Liste)“, `both` bleibt als Testmodus (entfällt später mit Issue #21).
- Variante C: Ausgabe der Startseite unverändert, kein Boxen-Layout, kein Tooltip, keine neuen Elemente. Die drei neuen Einstellungen haben bei C keine Wirkung und sind im Admin dann ausgeblendet.
- Varianten A, B und `both`: Die lange Liste der Gruppen und Dienste (`ServiceGroup`) entfällt. Unter dem Raster steht die Langform in drei Blöcken in dieser Reihenfolge: **„Aktuelle Störungen“** (alle offenen Störungen mit ihren Aktualisierungen, neu), **„Geplante Wartungen“** (wie bisher) und **„Vergangene Störungen“** (nur gelöste Störungen der letzten 5 Tage, wie bisher gruppiert nach Tag, offene Störungen stehen dort nicht mehr). In Variante C bleibt es beim bisherigen Aufbau (offene Störungen stehen im Tageslisting).
- Neue Einstellungen in `settings`: `statusBoxEntries` (Zahl, 1 bis 10, Voreinstellung 3), `statusBoxContent` (`full` oder `compact`, Voreinstellung `full`), `statusBoxesPlacement` (`before` oder `after`, Voreinstellung `before`). Beschriftungen über `ta('English', 'Deutsch')` aus `@/lib/i18n/admin`, Oberflächentexte über `src/lib/i18n/de.ts` und `en.ts`.
- Tooltip an der Gruppe: nur die Dienste, je mit Punkt in der Farbe des Zustands, ohne Beschreibung und ohne Zustandstext. Der Zustand steht als versteckter Text (`sr-only`) am Punkt. Die Dienstliste jeder Gruppe liegt immer im HTML der Kachel, nur die Sichtbarkeit wechselt (Suchmaschinen, Screenreader).
- Tooltip schließt 250 ms nach dem Verlassen von Kachel und Tooltip, nicht früher, und liegt ohne Lücke an der Kachel. Klick in den Tooltip öffnet das Dienstfeld der Gruppe. Esc schließt. Auf Touch zeigt das erste Tippen den Tooltip, das zweite das Dienstfeld.
- Boxen: Kurzform zeigt höchstens `statusBoxEntries` Einträge je Box, der Rest steht hinter „n weitere anzeigen“ mit Sprung zur Langform (`#incidents` für den Block „Aktuelle Störungen“, `#maintenance` für „Geplante Wartungen“). Die Box und der Block „Aktuelle Störungen“ zeigen dieselben Störungen, die Box gekürzt, der Block vollständig. Ist die Box leer, steht ein Satz („Keine aktuellen Störungen.“, „Keine Wartungen geplant oder laufend.“), die Box bleibt sichtbar.
- Keine Änderung an Berechnung der Verfügbarkeit, am Verfügbarkeitsbericht und an Benachrichtigungen.
- Prüfen mit `npm run test:unit`, `npx tsc --noEmit`, `npm run lint`. E2E nach `docs/src/development/testing.md`, Umgebung von Hand starten, wenn `scripts/run-e2e-tests.sh` nach 2,5 Minuten abbricht.

## Review Focus

- 36 Gruppen (Dev) und viele Dienste: Seitengröße und Rechenzeit bleiben im Rahmen, Tooltip-Listen vergrößern das HTML nur um Dienstnamen (Task 6, 8).
- Mehr offene Störungen oder Wartungen als eingestellt, genau so viele, keine: „weitere anzeigen“ erscheint nur bei Rest, leere Box zeigt den Satz (Task 2, 3).
- Störung ohne verknüpften Dienst, Wartung ohne Ende (`scheduledEndAt` leer): Eintrag erscheint ohne Dienstliste bzw. ohne Endzeit, kein Absturz (Task 2).
- Eintrag ohne Aktualisierung (`updates` leer): „letzter Stand“ entfällt statt „undefined“ (Task 2).
- Eine Störung ist offen und älter als 5 Tage: sie steht im Block „Aktuelle Störungen“ und fehlt in „Vergangene Störungen“, sie geht nicht verloren (Task 5).
- Wert der Einstellung außerhalb des Bereichs (0, 11, Text, leer): fällt auf die Voreinstellung bzw. wird begrenzt (Task 2).
- Wechsel der Variante im Admin: bei C erscheinen keine Boxen und kein Tooltip, bei A und B die Boxen auch bei „Alles ruhig“ (Task 5).
- Tastatur und Touch: Tab erreicht jede Kachel und zeigt den Tooltip, Esc schließt, auf Touch öffnet das zweite Tippen das Dienstfeld (Task 6).
- `?gruppe=<id>` in der Adresse (Lesezeichen aus dem Bestand) wählt weiter die Gruppe, ohne Parameter ist in Variante A die Kachel „Alle“ gewählt (Task 4).

## Dateien

| Datei | Aufgabe |
|---|---|
| `src/globals/Settings.ts`, `src/migrations/20261113_200000_add_status_box_settings.ts`, `src/migrations/index.ts`, `src/payload-types.ts` | drei Felder, neue Beschriftungen der Variante |
| `src/lib/status-boxes.ts` (neu) | Werte lesen, Boxeinträge bauen, Einträge begrenzen |
| `src/lib/availability.ts`, `src/lib/lagebild.ts` | Zustandsfolge einer Gruppe, Verfügbarkeit je Gruppe |
| `src/components/status/StatusBoxes.tsx` (neu) | Boxen „Aktuelle Störungen“ und „Wartungen“ |
| `src/components/status/lagebild/Lagebild.tsx`, `AllGroupsPanel.tsx` (neu), `GroupTooltip.tsx` (neu) | Kachel „Alle“, Gruppenzeilen, Tooltip |
| `src/app/(frontend)/page.tsx` | Layout je Variante, Daten für die Boxen |
| `src/lib/i18n/de.ts`, `en.ts` | neue Texte |
| `tests/unit/status-boxes.test.ts`, `status-box-settings.test.ts`, `status-boxes-view.test.tsx`, `group-availability.test.ts`, `tests/e2e/status-boxes.spec.ts` | Tests |
| `docs/src/development/browser-checklist.md` | Abschnitt für das neue Layout |

---

### Task 1: Einstellungen und Migration

**Files:**
- Modify: `src/globals/Settings.ts` (Block „Situation overview“, ab Zeile 163), `src/migrations/index.ts`, `src/payload-types.ts`
- Create: `src/migrations/20261113_200000_add_status_box_settings.ts`
- Test: `tests/unit/status-box-settings.test.ts`

**Interfaces:**
- Produces: Felder `statusBoxEntries: number`, `statusBoxContent: 'full' | 'compact'`, `statusBoxesPlacement: 'before' | 'after'` auf `Setting` (`@/payload-types`).

- [ ] **Step 1: Test `status-box-settings.test.ts` schreiben.** Er importiert `Settings` aus `@/globals/Settings`, sucht die drei Felder rekursiv in `fields` (Collapsible) und prüft: `statusBoxEntries` hat `defaultValue: 3`, `min: 1`, `max: 10`; `statusBoxContent` hat Werte `['full','compact']` und Vorgabe `full`; `statusBoxesPlacement` hat Werte `['before','after']` und Vorgabe `before`; die Optionen von `lagebildVariant` enthalten `off`, `a`, `b`, `both`, und die Beschriftung von `off` enthält „Variant C“ (Test über `JSON.stringify`, da `ta` eine Zeichenkette liefert).
- [ ] **Step 2: Test laufen lassen:** `npx tsx --test tests/unit/status-box-settings.test.ts`. Erwartet: FAIL (Felder fehlen).
- [ ] **Step 3: Felder in `Settings.ts` ergänzen**, direkt nach `lagebildBarHours`, im selben Collapsible. Alle drei bekommen `admin.condition: (data) => data?.lagebildVariant !== 'off'`. Beschriftungen der Optionen von `lagebildVariant` ändern: `off` → `ta('Variant C (simple list)', 'Variante C (einfache Liste)')`, `a` → `ta('Variant A (tiles, services with bars on click)', 'Variante A (Kacheln, Dienste mit Balken beim Anklicken)')`, `b` → `ta('Variant B (tiles with own bar)', 'Variante B (Kacheln mit eigenem Balken)')`. Die Beschreibung des Feldes nennt, dass die drei Einstellungen darunter nur für A, B und „Beide“ gelten.
- [ ] **Step 4: Migration `20261113_200000_add_status_box_settings.ts`** nach dem Muster von `20261110_200000_add_lagebild_bar_hours.ts`: zwei Enum-Typen (`enum_settings_status_box_content`, `enum_settings_status_boxes_placement`) und drei Spalten in `settings` (`status_box_entries` numeric Vorgabe 3, `status_box_content` Vorgabe `full`, `status_boxes_placement` Vorgabe `before`); `down` entfernt Spalten und Typen. In `src/migrations/index.ts` eintragen (Muster der vorhandenen Einträge).
- [ ] **Step 5: Typen erzeugen:** `npm run generate:types`. Erwartet: `src/payload-types.ts` enthält die drei Felder.
- [ ] **Step 6: Prüfen:** `npx tsx --test tests/unit/status-box-settings.test.ts` (PASS), `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 7: Commit:** `feat(statusseite): Füge Einstellungen der Boxen hinzu (#73)`.

---

### Task 2: Aufbereitung der Boxeinträge

**Files:**
- Create: `src/lib/status-boxes.ts`
- Test: `tests/unit/status-boxes.test.ts`

**Interfaces:**
- Consumes: `LagebildStatus` aus `@/lib/lagebild`, `DateTimeConfig`, `formatDateTime`, `formatTime` aus `@/lib/datetime`.
- Produces (alle aus `@/lib/status-boxes`):
  - `type BoxContent = 'full' | 'compact'`, `type BoxesPlacement = 'before' | 'after'`
  - `BOX_ENTRIES_DEFAULT = 3`, `BOX_ENTRIES_MIN = 1`, `BOX_ENTRIES_MAX = 10`
  - `parseBoxEntries(value: unknown): number` (ganze Zahl, begrenzt auf 1 bis 10, sonst 3), `parseBoxContent(value: unknown): BoxContent` (sonst `full`), `parseBoxesPlacement(value: unknown): BoxesPlacement` (sonst `before`)
  - `type BoxItem = { id: string; href: string; title: string; status: LagebildStatus; stateLabel: string; when: string; services: string[]; last: string | null }`
  - `limitBoxItems<T>(items: T[], limit: number): { shown: T[]; more: number }`
  - `buildIncidentItems(incidents: BoxIncident[], dt: DateTimeConfig): BoxItem[]` (nur Störungen mit letztem Status ungleich `resolved`, in der Reihenfolge der Eingabe)
  - `buildMaintenanceItems(maintenances: BoxMaintenance[], dt: DateTimeConfig): BoxItem[]` (nur Status `upcoming` und `in_progress`, nach `scheduledStartAt` aufsteigend)
  - `BoxIncident`/`BoxMaintenance`: strukturelle Teilmengen von `Incident`/`Maintenance` (`id`, `shortId`, `title`, `impact` bzw. keiner, `updates`, `affectedServices` als Objekte mit `name` oder Ids, bei Wartungen `status`, `scheduledStartAt`, `scheduledEndAt`).

- [ ] **Step 1: Tests schreiben** in `tests/unit/status-boxes.test.ts` (je ein `test`):
  - `parseBoxEntries`: `'3'→3`, `0→3`, `11→10`, `-2→1`, `'abc'→3`, `undefined→3`, `4.7→4`. `parseBoxContent('x')` ergibt `full`, `parseBoxesPlacement('after')` ergibt `after`.
  - `limitBoxItems([1,2,3,4], 3)` ergibt `{shown:[1,2,3], more:1}`; bei Gleichstand `more: 0`; leere Liste ergibt `{shown:[], more:0}`.
  - `buildIncidentItems`: gelöste Störung (letztes Update `resolved`) fehlt; offene Störung hat `href: '/i/<shortId>'`, `status` gleich `impact`, `stateLabel` aus dem Status der letzten Aktualisierung, `last` gleich Text der letzten Aktualisierung; Störung ohne `updates` hat `last: null` und kein „undefined“ im `stateLabel`; Störung ohne Dienste hat `services: []`.
  - `buildMaintenanceItems`: `completed` und `cancelled` fehlen; `href: '/m/<shortId>'`, `status: 'maintenance'`; Wartung ohne `scheduledEndAt` hat in `when` nur den Beginn („ab …“ nach `maintenance.noticeSoonOpen`-Muster); Sortierung nach Beginn.
- [ ] **Step 2: Laufen lassen:** `npx tsx --test tests/unit/status-boxes.test.ts`. Erwartet: FAIL (Modul fehlt).
- [ ] **Step 3: `status-boxes.ts` implementieren** mit den Signaturen oben. `stateLabel` über vorhandene Texte (`incidentStatus.*` o. ä. in `de.ts`, nachsehen; fehlende Schlüssel in `de.ts` und `en.ts` ergänzen), `when` mit `formatDateTime` und der Zeitzone aus `dt`.
- [ ] **Step 4: Laufen lassen.** Erwartet: PASS.
- [ ] **Step 5: Commit:** `feat(statusseite): Bereite Boxeinträge auf (#73)`.

---

### Task 3: Boxen als Komponente

**Files:**
- Create: `src/components/status/StatusBoxes.tsx`
- Modify: `src/lib/i18n/de.ts`, `src/lib/i18n/en.ts`
- Test: `tests/unit/status-boxes-view.test.tsx`

**Interfaces:**
- Consumes: `BoxItem`, `BoxContent`, `limitBoxItems` aus Task 2.
- Produces: `StatusBoxes({ incidents, maintenances, entries, content }: { incidents: BoxItem[]; maintenances: BoxItem[]; entries: number; content: BoxContent }): JSX.Element` (Server-Komponente, `<aside aria-label>` mit zwei `<section>`, je mit `data-testid="box-incidents"` bzw. `"box-maintenances"`, Eintrag `data-testid="box-item"`, Dienst-Chip `data-testid="box-service"`, Rest-Link `data-testid="box-more"`).

- [ ] **Step 1: Tests schreiben** (`renderToStaticMarkup`, Muster `report-send-button.test.tsx`): vier Einträge bei `entries: 3` ergeben drei `box-item` und einen Link „1 weitere anzeigen“ mit `href="#incidents"` bzw. `#maintenance`; genau drei Einträge ergeben keinen `box-more`; keine Einträge ergeben den Satz „Keine aktuellen Störungen.“ bzw. „Keine Wartungen geplant oder laufend.“ und die Zahl 0 im Zähler; `content: 'compact'` lässt Dienste und letzten Stand weg, Titel, Zustand und Zeit bleiben; `content: 'full'` zeigt Dienste (als Chips) und letzten Stand; `last: null` erzeugt kein leeres Element.
- [ ] **Step 2: Laufen lassen.** Erwartet: FAIL.
- [ ] **Step 3: Komponente und Texte** (`statusBoxes.incidentsTitle`, `.maintenancesTitle`, `.noIncidents`, `.noMaintenances`, `.more` mit `{count}`) in `de.ts` und `en.ts`. Gestaltung nach dem Mockup: Karte mit Kopf und Zähler, Eintrag mit Streifen in der Zustandsfarbe (Klassen aus `lagebild/status-styles.ts`).
- [ ] **Step 4: Laufen lassen.** Erwartet: PASS. `npx tsc --noEmit`.
- [ ] **Step 5: Commit:** `feat(statusseite): Zeige Störungen und Wartungen in Boxen (#73)`.

---

### Task 4: Kachel „Alle“ und Verfügbarkeit je Gruppe

**Files:**
- Modify: `src/lib/availability.ts`, `src/lib/lagebild.ts` (`LagebildGroup`, `loadLagebild`), `src/components/status/lagebild/Lagebild.tsx`
- Create: `src/components/status/lagebild/AllGroupsPanel.tsx`
- Test: `tests/unit/group-availability.test.ts`

**Interfaces:**
- Produces: `mergeTimelines(timelines: Timeline[]): Timeline` in `availability.ts` (an jedem Wechselzeitpunkt einer Zeitfolge der schlechteste Zustand aller Zeitfolgen, Zeitpunkte aufsteigend, Wiederholungen gleichen Zustands entfallen). `LagebildGroup` bekommt `availability: number | null` und `availabilityLabel: string`. `ALL_GROUPS = '__all__'` aus `Lagebild.tsx`. `AllGroupsPanel({ data, onSelect, onClose }: { data: LagebildData; onSelect: (groupId: string) => void; onClose: () => void })`.

- [ ] **Step 1: Test `group-availability.test.ts`:** `mergeTimelines` mit zwei Zeitfolgen (A: `operational` ab 0, `partial` ab 10, `operational` ab 20; B: `operational` ab 0, `degraded` ab 15) ergibt Zustände `operational@0`, `partial@10`, `partial`-Fortsetzung ohne Wiederholung, `degraded@20`; leere Eingabe ergibt `[]`. `computeAvailability(mergeTimelines([...]), 0, 40)` stimmt mit der von Hand gerechneten Zahl überein (Teilausfall zählt als Ausfall: 10 bis 20 von 40, also 75).
- [ ] **Step 2: Laufen lassen.** Erwartet: FAIL.
- [ ] **Step 3: `mergeTimelines` implementieren, in `loadLagebild` je Gruppe `computeAvailability(mergeTimelines(groupTimelines), windowStart, now)` und `formatAvailability` setzen.** `lagebild-cache.ts` speichert das Ergebnis bereits als Ganzes, dort keine Änderung.
- [ ] **Step 4: `Lagebild.tsx`:** Auswahl `selected: string | null` darf `ALL_GROUPS` sein. Erste Kachel `TileAll` (A und B, Icon-Text „ALLE“, Zustand aus `worstStatus` aller Gruppen, Meta „n Gruppen · m betroffen“ nach dem Muster von `serviceMeta`, in B zusätzlich der Balken `computeBarRuns` über alle Gruppen: dafür `LagebildData` um `allBars: BarRun[]` erweitern). `AllGroupsPanel` zeigt je Gruppe eine Zeile (Name, Zustand, Balken, `availabilityLabel`), Klick auf eine Zeile ruft `onSelect(group.id)`. `PeriodList` behandelt `ALL_GROUPS` wie „keine Gruppe gewählt“. Ohne `?gruppe` ist in Variante A `ALL_GROUPS` vorausgewählt, in B nichts. `?gruppe=<id>` wählt wie bisher die Gruppe. Bei `ALL_GROUPS` bleibt `?gruppe` aus der Adresse.
- [ ] **Step 5: Prüfen:** `npx tsx --test tests/unit/group-availability.test.ts` (PASS), `npx tsc --noEmit`, `npm run lint`. Bestehende Tests `tests/e2e/lagebild.spec.ts` bleiben unverändert grün (später in Task 7 gemeinsam gelaufen).
- [ ] **Step 6: Commit:** `feat(lagebild): Füge die Kachel „Alle“ hinzu (#73)`.

**Abweichung vom Mockup:** Die Kachel „Alle“ zeigt „n Gruppen · m betroffen“, **keine** Gesamtverfügbarkeit in Prozent. Der Mittelwert über alle Gruppen wäre eine neue Rechenregel, und der schlechteste Zustand über alle Gruppen wäre fast immer niedrig. Die Zeilen je Gruppe zeigen die Verfügbarkeit der Gruppe (schlechtester Dienst zählt).

---

### Task 5: Layout je Variante

**Files:**
- Modify: `src/app/(frontend)/page.tsx`, `src/components/status/IncidentTimeline.tsx` (nur wenn die Gruppenüberschrift „Aktuelle Störungen“ dort nicht über die Props ausdrückbar ist)
- Test: `tests/e2e/status-boxes.spec.ts` (Anfang)

**Interfaces:**
- Consumes: `StatusBoxes`, `parseBoxEntries`, `parseBoxContent`, `parseBoxesPlacement`, `buildIncidentItems`, `buildMaintenanceItems`.
- Produces: Seitenaufbau, `id="incidents"` (Aktuelle Störungen), `id="maintenance"` (Geplante Wartungen) und `id="past-incidents"` (Vergangene Störungen) an den Langform-Abschnitten, `data-testid="status-layout"` mit `data-variant` und `data-placement` am Hauptraster.

- [ ] **Step 1: E2E-Test `status-boxes.spec.ts`** (Muster `lagebild.spec.ts`, `serial`, `afterAll` setzt `lagebildVariant: 'off'` zurück):
  - Variante `off`: `status-layout` fehlt, `service-row` ist sichtbar (Liste wie heute).
  - Variante `a`: `status-layout` vorhanden, `service-row` fehlt, `box-incidents` und `box-maintenances` sichtbar.
  - Mit einer offenen Störung (`createIncident`) erscheint ihr Titel in `box-incidents`; eine gelöste Störung nicht.
  - `statusBoxEntries: 1` bei zwei offenen Störungen: ein `box-item`, `box-more` mit „1 weitere“.
  - `statusBoxContent: 'compact'`: kein `box-service` (Dienstliste) im Eintrag.
  - `statusBoxesPlacement: 'after'`: `data-placement="after"`.
  - Ohne Störungen: Satz „Keine aktuellen Störungen“ in der Box und im Block `incidents`.
  - Mit einer offenen und einer gelösten Störung: Der Block `incidents` enthält nur die offene, der Block `past-incidents` nur die gelöste. Bei vier offenen Störungen und `statusBoxEntries: 3` zeigt die Box drei, der Block alle vier.
  - Variante `off`: offene Störungen stehen weiter im Tageslisting, es gibt keinen Block `incidents`.
- [ ] **Step 2: Test laufen lassen.** Erwartet: FAIL.
- [ ] **Step 3: `getStatusData` erweitern:** Störungen für die Boxen mit `payload.find({ collection: 'incidents', where: { status: { not_equals: 'resolved' } }, sort: '-createdAt', depth: 1, limit: 50 })`, Wartungen aus der vorhandenen Abfrage (`maintenances`, mit `depth: 1` für die Dienstnamen; Filter auf `upcoming` und `in_progress` übernimmt `buildMaintenanceItems`). Einstellungen mit den `parse…`-Funktionen lesen.
- [ ] **Step 4: Render:** Bei `off` bleibt der Baum der Seite unverändert. Bei `a`, `b`, `both`: Banner, dann Raster `grid` mit `lg:grid-cols-[minmax(0,1.9fr)_minmax(18rem,1fr)]` (Lagebild links, `StatusBoxes` rechts); unter `lg` steht je nach `statusBoxesPlacement` die Box vor oder nach dem Lagebild (`order-first` bzw. `order-last`). Hauptbreite von `max-w-4xl` auf `max-w-6xl` nur in diesen Varianten. `ServiceGroup`-Schleife und `StatusLegend` entfallen in diesen Varianten (Legende: siehe Offene Punkte). Langform darunter in drei Blöcken (siehe Global Constraints). „Aktuelle Störungen“ nutzt `IncidentTimelineWithLinks` mit einer einzigen Gruppe (Überschrift der Gruppe aus dem neuen Text `home.currentIncidents`), „Vergangene Störungen“ übergibt `pastIncidents` ohne offene Störungen (Filter auf den Status der letzten Aktualisierung). Der Block „Aktuelle Störungen“ entfällt, wenn keine Störung offen ist, nur die Box zeigt dann ihren Satz; der Anker `#incidents` führt in diesem Fall nirgends hin, weil die Box dann keinen Rest-Link hat.
- [ ] **Step 5: Test laufen lassen.** Erwartet: PASS. `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 6: Commit:** `feat(statusseite): Teile die Seite in Lagebild und Boxen (#73)`.

---

### Task 6: Tooltip an der Gruppe

**Files:**
- Create: `src/components/status/lagebild/GroupTooltip.tsx`
- Modify: `src/components/status/lagebild/Lagebild.tsx` (`TileA`, `TileB`, `TileAll`)
- Test: `tests/unit/group-tooltip.test.tsx`, `tests/e2e/status-boxes.spec.ts` (Ergänzung)

**Interfaces:**
- Produces: `GroupTooltip({ id, title, items, open, onEnter, onLeave, onActivate }: { id: string; title: string; items: Array<{ name: string; status: LagebildStatus }>; open: boolean; onEnter: () => void; onLeave: () => void; onActivate: () => void }): JSX.Element` (`role="tooltip"`, Liste immer im DOM, Sichtbarkeit über `open`, je Dienst ein Punkt `aria-hidden` und ein `sr-only`-Text mit `statusLabel`). Hook `useDelayedHover(delayMs = 250): { open: boolean; enter: () => void; leave: () => void; close: () => void }` im selben Modul.

- [ ] **Step 1: Unit-Test `group-tooltip.test.tsx`** (`renderToStaticMarkup`): geschlossen enthält die Dienstnamen weiterhin im Markup (Liste im DOM) und hat `data-open="false"`; geöffnet `data-open="true"`; jeder Dienst hat einen `sr-only`-Text mit dem Zustand (z. B. „Teilausfall“); keine Beschreibungstexte.
- [ ] **Step 2: E2E-Tests ergänzen** (Variante `a`, Gruppe mit zwei Diensten, einer `partial`): Hover über die Kachel macht den Tooltip sichtbar; Maus in den Tooltip (Bewegung in 15 Schritten) lässt ihn sichtbar; Klick im Tooltip zeigt das Dienstfeld (`lagebild-panel-<id>`); Maus weg schließt ihn nach spätestens 500 ms; Tab fokussiert die Kachel und zeigt ihn, Esc schließt; mit `hasTouch: true` zeigt das erste `tap` den Tooltip und das zweite das Dienstfeld.
- [ ] **Step 3: Tests laufen lassen.** Erwartet: FAIL.
- [ ] **Step 4: Implementieren.** Tooltip liegt direkt unter der Kachel und überlappt ihren unteren Rand um 4 px (keine Lücke), `z-index` über den Nachbarkacheln, Breite `min(340px, 100% des Rasters − 24px)`, waagerecht an den Rand des Rasters geklemmt. `aria-describedby` an der Kachel. Auf Touch (Eingabe `pointerType === 'touch'`) wählt der Klick zuerst den Tooltip, dann das Dienstfeld. Die Kachel „Alle“ bekommt einen Tooltip mit den Gruppen, die nicht betriebsbereit sind, und der Zahl der übrigen („9 weitere Gruppen betriebsbereit“).
- [ ] **Step 5: Tests laufen lassen.** Erwartet: PASS. `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 6: Commit:** `feat(lagebild): Zeige Dienste als Tooltip der Gruppe (#73)`.

---

### Task 7: Bestehende Tests, Prüfliste, Messung

**Files:**
- Modify: `tests/e2e/lagebild.spec.ts` (nur wenn Tests an der geänderten Kachelzahl scheitern), `docs/src/development/browser-checklist.md`

- [ ] **Step 1: Alle Tests laufen lassen:** `npm run test:unit`, `npx tsc --noEmit`, `npm run lint`, E2E komplett. Erwartet: alles bestanden. Scheitert `lagebild.spec.ts` an der zusätzlichen Kachel „Alle“ (z. B. Zählung der Kacheln), die Erwartung anpassen, nicht die Kachel.
- [ ] **Step 2: Prüfliste:** neuer Abschnitt „Neues Layout (A und B)“ in `browser-checklist.md` mit Punkten: Boxen rechts bei breitem Fenster, Boxen auf dem Handy vor bzw. nach dem Lagebild je Einstellung, Tooltip mit Maus (offen bleibt beim Wechsel in den Tooltip), Tooltip per Tippen und Tab, Kachel „Alle“, Dunkelmodus, Variante C unverändert.
- [ ] **Step 3: Messen:** Startseite mit 166 Diensten (Dev) in den Varianten A, B und C: Antwortzeit (`curl -w '%{time_total}'`, 10 Aufrufe) und HTML-Größe. Erwartung: A und B nicht mehr als 20 % über dem Wert von C bei gleicher Gruppenzahl, Antwortzeit unter 1,5 s. Werte in die PR-Beschreibung.
- [ ] **Step 4: Commit:** `test(statusseite): Ergänze Prüfliste und Messung (#73)`.

---

## Offene Punkte für Frank (vor oder bei der Umsetzung)

1. **Legende:** Das Mockup zeigt in A und B keine Legende der Zustandsfarben. Der Plan lässt sie dort weg (Zustandsnamen stehen an den Kacheln, Tooltip-Punkte tragen versteckten Text). Soll sie unter dem Lagebild bleiben?
2. **Beschreibungen der Dienste** erscheinen in A und B nirgends mehr (nur in C). Das folgt aus der Entscheidung zum Tooltip. Ein Folge-Issue wäre nötig, falls Besucher sie brauchen.
3. **Gesamtverfügbarkeit** in der Kachel „Alle“ entfällt (siehe Abweichung in Task 4).

## Nicht Teil dieses Plans

- Neue Benachrichtigungswege, Änderungen an Inhalten von Wartungen und Störungen, Änderungen an Berechnung und Bericht (stehen so im Issue #73).
- Entfernen von Variante B und des Testmodus „Beide“: Issue #21.
- Handbuch und Wiki im Projekt `yasp.io`: eigene Sitzung nach dem Merge.
