# Verfügbarkeitsbericht: Konzept

Stand 11.11.2026. Issue #46 im Fork (GitHub). Meilenstein „Verfügbarkeitsbericht“.

Entscheidungen von Frank Albrecht sind als „entschieden“ gekennzeichnet. Alles andere ist ein Vorschlag und steht unter „Annahmen zur Bestätigung“ (Abschnitt 9).

## 1. Zweck

Der Betreiber liefert jeden Monat die Verfügbarkeit der Dienste als Input für eine PowerPoint-Präsentation. Die Folien baut ein Kollege. YASP soll dafür einen Bericht erzeugen, den Management und Produktmanager ohne Erklärung lesen. Der Bericht beantwortet drei Fragen:

1. Sind wir besser geworden als im Zeitraum davor?
2. Welcher Dienst macht Probleme, und wie lange dauerten die Ausfälle?
3. Wie war die Entwicklung über die Monate?

Zielgruppe der ersten Fassung: Geschäftsführung, Bereichsleiter, Abteilungsleiter und Produktmanager. Kundenberater, Kunden und Servicedesk folgen später (entschieden).

## 2. Ziele, Nicht-Ziele

**Ziele**

- Bericht im Admin-Bereich von YASP, wahlweise für alle Gruppen oder für eine gewählte Gruppe mit ihren Einzelkomponenten (entschieden).
- Zeiträume: Monat, Quartal, Halbjahr, Jahr, freier Zeitraum (entschieden).
- Vergleich mit dem Zielwert und mit dem gleich langen Zeitraum davor.
- Ausgabe als PDF und Excel. In Excel kann eine Person „ihre“ Gruppen auswählen (entschieden).
- Verlauf auch für die Zeit vor dem 10.11.2026, nachgerechnet aus den Vorfällen (entschieden).

**Nicht-Ziele**

- Kein Bericht auf der öffentlichen Statusseite. Die Berichte sind nur für angemeldete Administratoren sichtbar (Annahme, Abschnitt 9).
- Keine Pflege von Zielwerten für Gruppen und Komponenten in der ersten Fassung. Das Datenmodell sieht die drei Stufen vor, die Eingabe kommt später (entschieden).
- Kein Ersatz für die Folien. YASP liefert Zahlen und Grafiken, kein PowerPoint.
- Kein neues Aussehen der Lagebild-Seite. Ihre Berechnung ändert sich aber (Abschnitt 4.6).

**Ausschlusskriterium (Anti-Ziel):** Ein Bericht, der 18 Monate lang 100 % Verfügbarkeit ausweist, weil Vorfälle falsch eingeordnet wurden, ist ein Fehlschlag, auch wenn er technisch funktioniert.

## 3. Ausgangslage

| Sachverhalt | Stand in Dev am 11.11.2026 |
|---|---|
| Statusprotokoll `service-status-events` | 166 Einträge, einer je Dienst, alle vom 10.11.2026 15:56 Uhr (Startwerte der Migration `20261110_150700_add_lagebild`) |
| Vorfälle (`incidents`) | 165, von 05.05.2025 bis 22.10.2026, alle gelöst, alle mit gespeicherter Auswirkung „Eingeschränkt“ (`degraded`) |
| Vorfälle mit Dienstverknüpfung (`incidents_rels`) | 146, 19 ohne Dienst (darunter ADVIS, Vorfall 126, 39 Tage) |
| Wartungen (`maintenances`) | 0 |
| Dienste und Gruppen | 166 Dienste in 36 Gruppen |
| Aufbewahrung | Nichts löscht Einträge des Statusprotokolls automatisch |

Vorhandene Rechenfunktion: `computeAvailability(timeline, windowStart, now)` in `src/lib/lagebild.ts`. Sie zählt „Teilausfall“ und „Schwerer Ausfall“ als nicht verfügbar. „Eingeschränkt“ und „Wartung“ zählen als verfügbar. Die Lagebild-Seite zeigt Verfügbarkeit nur je Dienst, nicht je Gruppe.

## 4. Rechenregeln

### 4.1 Verfügbarkeit (entschieden)

Unverändert die Regel des Lagebilds: Anteil der bekannten Zeit ohne Teilausfall und Schwerer Ausfall. Der Bericht weist zusätzlich die Dauer in den Status „Eingeschränkt“ und „Wartung“ als eigene Zeilen aus. Beide beeinflussen die Prozentzahl nicht. Anzeige mit zwei Nachkommastellen, abgerundet (`formatAvailability`).

### 4.2 Längere Zeiträume (entschieden)

- **Rechenart 1 (Standard):** ein Wert für den ganzen Zeitraum, also Ausfallzeit geteilt durch bekannte Zeit des Zeitraums.
- **Rechenart 2 (wählbar):** Mittelwert der Monatswerte.

Beispiel aus Dev, 12 Monate November 2025 bis Oktober 2026 (alle Vorfälle als Teilausfall):

| Gruppe | Rechenart 1 | Rechenart 2 |
|---|---|---|
| KFZ-Zulassung | 98,554 % | 98,574 % |
| Haushalt und Finanzen | 99,807 % | 99,808 % |

Der Unterschied ist höchstens 0,02 Punkte (verschieden lange Monate).

### 4.3 Dritte Kennzahl (entschieden)

„Monate mit erreichtem Ziel“, zum Beispiel „8 von 12“. Sie zeigt Einzelmonate, die ein Durchschnitt verdeckt. Beispiel: KFZ-Zulassung liegt im Jahresmittel bei 98,6 %, verfehlte das Ziel aber in 4 von 12 Monaten.

### 4.4 Zielwert (entschieden)

Drei Stufen, die genaueste gilt:

1. Gesamtzielwert, gilt, wenn weder Gruppe noch Komponente einen Wert hat.
2. Zielwert der Gruppe, gilt für die Gruppe und alle ihre Komponenten ohne eigenen Wert.
3. Zielwert der Komponente.

Erste Fassung: nur Gesamtzielwert **99 %**. Der Zielwert gilt für den Monat. Bei längeren Zeiträumen vergleicht der Bericht den Wert des Zeitraums (nach Rechenart 1 oder 2) mit demselben Zielwert.

Vorschlag für das Datenmodell (Annahme): Zahlenfeld `availabilityTarget` in einem Global (Gesamtzielwert, Standard 99) sowie als optionales Feld in `service-groups` und `services`. Leer bedeutet „erbt“. In der Rangliste steht später, welche Stufe den Wert geliefert hat („geerbt von Gesamt“).

### 4.5 Schwächste Dienste (entschieden)

Anzahl einstellbar, Standard 5, Minimum 3, Maximum 10. Es zählen nur Dienste mit mindestens einem Ausfall im Zeitraum, sortiert nach Verfügbarkeit aufsteigend.

### 4.6 Gemeinsame Berechnung mit dem Lagebild (entschieden am 12.11.2026)

Das Lagebild und der Bericht rechnen mit denselben Regeln und demselben Code. Eine Verfügbarkeit, die das Lagebild für einen Dienst und einen Zeitraum zeigt, stimmt mit der Zahl im Bericht überein.

- Die Berechnung (Verfügbarkeit nach 4.1, Dauer je Status, Zeiträume) liegt in einer gemeinsamen Funktion. Das Lagebild (`src/lib/lagebild.ts`) und der Bericht rufen sie auf.
- Die Nachrechnung aus Abschnitt 5 wirkt dadurch auch im Lagebild: Die Rückschau 90, 180 und 365 Tage zeigt echte Werte statt „seit 10.11.2026“.
- Für Zeiten ab dem 10.11.2026 bleiben die Zahlen des Lagebilds unverändert. Ein Test prüft das mit festen Eingaben.
- Ob das Lagebild den Zielwert oder einen Gruppenwert zeigt, ist nicht entschieden (Abschnitt 10).

## 5. Nachrechnung vor dem 10.11.2026

Das Statusprotokoll wird rückwirkend aus den Vorfällen gefüllt. Aus jedem Vorfall mit Dienstverknüpfung entsteht je Dienst ein Zeitraum vom Anlegen bis zum Lösen (`created_at` bis `resolved_at`) mit einem Status. Überlappende Zeiträume eines Dienstes zählen mit dem schlechtesten Status einmal. Nach dem Lösen gilt „Betriebsbereit“.

### 5.1 Einordnung der Vorfälle (entschieden)

Der Status eines Vorfalls ergibt sich in dieser Reihenfolge:

| Reihenfolge | Regel | Status | Anzahl in Dev |
|---|---|---|---|
| 1 | Titel enthält „Wartung“ (z. B. „Nichtverfügbarkeit des Services X aufgrund von Wartungsarbeiten“) | Wartung | 17 |
| 2 | Titel beginnt mit „Hinweis“ | keine Auswirkung | 3 |
| 3 | Text der Aktualisierungen enthält „Performance“, „Ladezeit“, „Wartezeit“, „langsam“, „Verzögerung“ oder „verzögert“ (nicht „Leistungsniveau“, das steht in der Vorlage jeder Erstmeldung) | Eingeschränkt | 16 |
| 4 | Titel beginnt mit „Vollständiger Serviceausfall“ | Schwerer Ausfall | 21 (vor Regel 3 gezählt) |
| 5 | alle übrigen, auch „Teilweiser Ausfall“ (35) und „Störung … Analysephase“ | Teilausfall | 35 mit klarem Titel, 89 nicht eindeutig (beide vor Regel 3 gezählt) |

Regel 3 steht vor 4 und 5, weil Frank die 16 Vorfälle mit Stichwort ausdrücklich als „Eingeschränkt“ gewertet hat (11.11.2026). Beispiel: Der Vorfall „Erstmeldung - teilweiser Ausfall des Services Nova AVA“ (40 Tage) beschreibt Performanceprobleme und zählt deshalb als Eingeschränkt, nicht als Teilausfall.

Die gespeicherte Auswirkung (`impact`) der Vorfälle wird **nicht** geändert.

### 5.2 Kennzeichnung im Bericht

Die Vorfälle der Regel 5 ohne klares Merkmal im Titel (89 in Dev vor Anwendung der Regel 3, danach entsprechend weniger) stehen im Bericht in einer Fußnote: „89 Vorfälle nicht eindeutig eingeordnet, als Teilausfall gewertet“. Vorfälle ohne Dienstverknüpfung (19 in Dev) stehen in einer zweiten Fußnote: „19 Vorfälle ohne Dienst nicht berücksichtigt“.

### 5.3 Technik (Vorschlag)

- **Migration:** einmal beim Einspielen, damit Dev, Test und Prod denselben Verlauf haben. Prüfen, ob die Zahlen auf Prod stimmen: Die Einordnung gilt für die Titel in Dev und muss mit Prod abgeglichen werden.
- Einträge der Nachrechnung tragen ein Kennzeichen (z. B. Feld „Quelle“: Nachrechnung oder Betrieb), damit sie sich unterscheiden und neu erzeugen lassen.
- Die Migration muss wiederholbar sein (erneutes Ausführen erzeugt keine Doppeleinträge) und die Startwerte vom 10.11.2026 beibehalten.
- Auffällig lange Vorfälle (über 14 Tage: NOVA AVA 40 Tage, ADVIS 29 Tage, Internetleitungen 25 Tage) bleiben, wie sie sind. Vorfall 20 (ADVIS) wurde vermutlich zu früh geschlossen (Text „Update März 26“). Die tatsächliche Dauer ist unbekannt.

### 5.4 Annahme zur bekannten Zeit

Ein Dienst gilt in der Nachrechnung ab 05.05.2025 (erster Vorfall) als bekannt, nicht ab seinem Anlegedatum (Dienste wurden erst am 06.11.2026 angelegt). Die Verfügbarkeit älterer Monate fällt dadurch etwas günstiger aus, als sie YASP führen würde.

## 6. Inhalt des Berichts

Von oben nach unten. Gilt für „alle Gruppen“ und, nach Auswahl, für eine Gruppe.

1. **Kennzahlen:** Verfügbarkeit gesamt mit Vergleich zum Zeitraum davor, Ausfallzeit aller Dienste, betroffene Dienste (von n), Anzahl der Ausfälle, längster Ausfall mit Dienstnamen, Monate mit erreichtem Ziel, Zielstatus („erreicht“ oder „verfehlt um … Punkte“).
2. **Zeilen „Eingeschränkt“ und „Wartung“** mit Dauer, Wartung abschaltbar.
3. **Die schwächsten Dienste:** Verfügbarkeit, Ausfallzeit, Anzahl der Ausfälle, Wert des Zeitraums davor.
4. **Verlauf der letzten 12 Monate** als Linie mit gestrichelter Zielwertlinie und Hover.
5. **Wärmekarte:** Gruppen mal Monate (bei gewählter Gruppe: Dienste mal Monate), oben eine Gesamtzeile. Farbstufen: 100 %, ab 99,9 %, ab 99,5 %, ab Ziel, unter Ziel. Die ersten zwölf Zeilen, die übrigen aufklappbar.
6. **Rangliste der Dienste:** schwächste zuerst, mit Verfügbarkeit, Veränderung zum Vormonat, Ausfalldauer als Balken mit Anzahl und längstem Ausfall, Verlauf über 12 Monate, Vermerk „unter Ziel“.
7. **Fußnoten** nach Abschnitt 5.2.

Der Entwurf mit echten Dev-Daten liegt als Artifact: https://claude.ai/artifact/6DPU1MdHrtpzoyN7aqt4ut (privat). Farbwahl: Blau über Gelb zu Rot statt Grün, Gelb, Rot, wegen Rot-Grün-Sehschwäche.

## 7. Teile und Reihenfolge

1. **Daten:** Zielwertfelder, Kennzeichen am Statusprotokoll, Migration zur Nachrechnung. Die Migration ist nicht umkehrbar (Regel „Migrationen laufen beim ersten Aufruf von /admin“). Dazu gehört die gemeinsame Berechnung nach 4.6, damit das Lagebild von Anfang an dieselben Zahlen zeigt.
2. **Berichtsseite** im Admin-Bereich (angemeldete Administratoren), mit Zeitraum, Gruppenwahl, Rechenart, Anzahl schwächster Dienste, Wartung ein/aus. Die Berechnung liegt in einer eigenen Funktion mit Tests, getrennt von der Darstellung.
3. **Export** als PDF und Excel. Excel enthält die Rohwerte je Dienst und Monat in Tabellenform, damit eine Person per Filter „ihre“ Gruppen wählen kann. PDF enthält die Grafiken.

Je Teil entsteht ein eigenes Issue mit Verweis auf Issue #46.

## 8. Dem Bauenden überlassen

- Technik der Berichtsseite im Admin-Bereich von Payload (eigene Ansicht oder Dashboard-Seite).
- Technik für PDF (z. B. Rendern der Berichtsseite) und Excel (z. B. `exceljs`). Beides läuft hinter dem Firmenproxy, Abhängigkeiten müssen in der Corporate-CA-Umgebung installierbar sein.
- Schreibweise der Tests (E2E-Suite des Projekts, siehe `tests/e2e/`).
- Aufbau der Migration (SQL oder Skript), solange sie wiederholbar und prüfbar ist.
- Schriften: keine Google Fonts einbinden (Branch `fix/serve-fonts-locally` zeigt, dass der Fork Schriften lokal ausliefert).

## 9. Annahmen zur Bestätigung

1. **Zugriff:** nur angemeldete Administratoren, nicht öffentlich.
2. **Aufbewahrung:** Statusprotokoll unbegrenzt.
3. **Gruppenwert:** Die Verfügbarkeit einer Gruppe ist der Mittelwert ihrer Dienste (jeder Dienst gleich gewichtet). Alternative: Zeit, in der kein Dienst der Gruppe ausgefallen war. Der Entwurf rechnet mit dem Mittelwert, das Lagebild kennt bisher keinen Gruppenwert.
4. **Prozentwert Gesamt:** Mittelwert über alle Dienste, gleich gewichtet.
5. **Dateikopf:** Neue Quelldateien erhalten den Kopf nach Skill `datei-kopf-konvention`.
6. **Vorfälle ohne Dienst:** bleiben außen vor, mit Fußnote. Alternative: Dienst nachpflegen.
7. **Prod:** Die Einordnung in Abschnitt 5.1 gilt für Dev. Vor dem Einspielen auf Prod ist die Zahl der Vorfälle je Regel zu vergleichen.

## 10. Offene Punkte

- Wer pflegt später Zielwerte auf Gruppen- und Komponentenebene, und in welchem Rhythmus?
- Aufnahme der Browser-Prüfliste und der Berichtsprüfung in die Prüfliste des Deployment-Projekts (`frank.albrecht/yasp`, Issue #47 im GitLab).
- Ob Kundenberater und Kunden einen eigenen, einfacheren Bericht bekommen (spätere Fassung).
- Ob das Lagebild künftig den Zielwert (z. B. als Vermerk „unter Ziel“) oder eine Verfügbarkeit je Gruppe zeigt.
