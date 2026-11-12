# Verfügbarkeitsbericht: Gruppenblatt und Export

Stand 12.11.2026. Issue #50 im Fork (GitHub), Teil 3 von Issue #46. Meilenstein „Verfügbarkeitsbericht“. Ergänzt das Konzept `2026-11-11-verfuegbarkeitsbericht-design.md` (Abschnitt 7, Teil 3).

Entscheidungen von Frank Albrecht sind als „entschieden“ gekennzeichnet. Eigene Festlegungen des Verfassers stehen in Abschnitt 8 und sind dort markiert.

## 1. Zweck

Ein Kollege baut aus den Monatszahlen eine PowerPoint. Er braucht Dateien, die er ohne YASP weitergibt: ein PDF des ganzen Berichts, einzelne Grafiken als Bilder und eine Tabelle zum Filtern. Der Betreiber erhält die Dateien zuerst selbst per Mail, später geht die Mail an den Kollegen.

Heute zeigt die Berichtsseite (`/admin/verfuegbarkeitsbericht`, Teil 2, Issue #49) alle Blöcke am Bildschirm. Sie hat keine Ansicht, die sich als eigenständige Grafik je Gruppe ausgeben lässt. Das Gruppenblatt (Abschnitt 4) schließt diese Lücke und ist Voraussetzung für den Export.

## 2. Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**
- Ein Klick auf der Berichtsseite liefert eine ZIP-Datei mit PDF, Excel und allen Bildern (entschieden).
- PDF und Excel sind zusätzlich einzeln ladbar.
- Zeitraum, Rechenart und Wartungsart der Berichtsseite gelten auch für den Export. Die ZIP-Datei enthält immer alle Gruppen. Im Gruppentab lädt eine eigene Schaltfläche nur die gewählte Gruppe.
- Nur angemeldete Administratoren dürfen exportieren.

**Nicht-Ziele (eigene Issues oder später)**
- Mailversand mit Empfängerfeldern: eigenes Issue, nach dem Export (entschieden). Der Export muss seine Dateien so liefern, dass der Versand sie ohne Umbau verwenden kann (Abschnitt 6).
- PowerPoint-Datei.
- Erweiterte Kennzahlen (MTTR, MTBF, Vorfallzahl), Ursache der Störung, vereinbarte Servicezeit, Tacho-Diagramm: eigene Sitzung, siehe Abschnitt 9.

**Anti-Ziele (wäre ein Fehlschlag, auch wenn es technisch läuft)**
- Ein Chromium oder anderer Browser im Produktions-Image. Die Testumgebung hat 768 MiB Arbeitsspeicher, ein Browser würde dort wie das Image 10c zum Speicherkill führen und das Image um mehrere hundert MiB vergrößern.
- Schriften von Google Fonts.
- Ampelfarben Grün und Rot. Der Bericht nutzt Blau über Gelb zu Rot (Rot-Grün-Sehschwäche, entschieden im Konzept).
- Ein Export, der bei 36 Gruppen alle Bilder gleichzeitig im Speicher hält.

## 3. Ergebnis: Inhalt der ZIP-Datei

Dateinamen ohne Umlaute und Leerzeichen. Der Zeitraum steht im Namen, z. B. `2026-10`.

```
verfuegbarkeitsbericht-2026-10/
  verfuegbarkeitsbericht-2026-10.pdf
  verfuegbarkeitsbericht-2026-10.xlsx
  gesamt/
    01-kennzahlen.png
    02-entwicklung-12-monate.png
    03-schwaechste-dienste.png
    04-waermekarte-gruppen-1.png        (je 12 Gruppen, bei mehr: -2, -3 …)
    05-dienste-schwaechste-zuerst.png
  gruppen/
    <gruppe>/
      00-gruppenblatt.png               (Blöcke 1 bis 5 untereinander)
      01-entwicklung-12-monate.png
      02-dienste-schwaechste-zuerst.png
      03-stoerungen-je-dienst.png       (nur bei Störungen im Monat)
      04-stoerungen-je-tag.png          (nur bei Störungen im Monat)
      05-waermekarte-dienste.png
```

Die Blöcke unter `gesamt/` entsprechen den Wünschen von Frank (entschieden): die fünf Kennzahlen-Kacheln der ersten Reihe, die Entwicklung über 12 Monate, die schwächsten Dienste, die Wärmekarte nach Dienstgruppen mit höchstens 12 Zeilen je Bild, die Rangliste „Dienste, schwächste zuerst“.

Bilder: PNG, weißer Hintergrund, hohe Auflösung (entschieden). Mindestens 2000 px Breite, damit sie in einer Folie scharf bleiben (Annahme des Verfassers).

## 4. Gruppenblatt

Ein Blatt je Gruppe mit fünf Blöcken von oben nach unten (entschieden, Mockup am 12.11.2026 abgenommen):

1. **Entwicklung der Gruppe, letzte 12 Monate:** Linie mit Zielwert. Der Gruppenwert ist der Mittelwert ihrer Dienste (Konzept, Annahme 3).
2. **Dienste der Gruppe, schwächste zuerst:** ein Balken je Dienst mit Verfügbarkeit und Ausfalldauer.
3. **Störungen im Monat je Dienst:** ein Balken je Dienst, aufgeteilt nach Schwerer Ausfall, Teilausfall und Eingeschränkt, in Stunden.
4. **Störungen im Monat je Tag:** an jedem Tag mit Störung ein schmaler Balken je betroffenem Dienst, Dienstname senkrecht darunter, Höhe in Stunden, Farbe nach Art der Störung.
   - Im Gesamtblatt steht die Achse mit allen Tagen des Monats (Fassung A).
   - Als Einzelbild stehen nur die Tage mit Störung (Fassung B), damit die Namen lesbar bleiben (entschieden).
5. **Wärmekarte der Dienste:** Dienste mal Monate, Farbstufen wie auf der Berichtsseite.

Block 3 und 4 erscheinen nur, wenn die Gruppe im Monat mindestens eine Störung hatte (entschieden).

Das Gruppenblatt ist auch auf der Berichtsseite sichtbar. Die Seite bekommt zwei Tabs (entschieden):

- **Gesamtbericht:** der bisherige Bericht, unverändert.
- **Gruppenberichte:** links eine Liste aller Gruppen, schwächste zuerst, mit Farbpunkt (unter Ziel, nahe am Ziel, im Ziel) und Verfügbarkeit. Rechts steht das Gruppenblatt der gewählten Gruppe. Beim Öffnen ist die schwächste Gruppe gewählt. Das Auswahlfeld „Gruppe“ entfällt.

Die Auswahl über den Tabs (Zeitraum, Rechenart, Wartung) und die Schaltfläche „Alles herunterladen (ZIP)“ gelten für beide Tabs. Die Adresse enthält Ansicht und Gruppe (`?ansicht=gruppen&gruppe=<id>`), damit sich ein Blatt als Link weitergeben lässt. Die Zahlen werden einmal für den ganzen Zeitraum berechnet, ein Gruppenblatt zeichnet sich erst beim Klick.

Auf Dev gibt es 36 Gruppen mit 166 Diensten, elf Gruppen haben nur einen Dienst (Stand 12.11.2026). Solche Gruppen werden wie alle anderen geführt: volles Gruppenblatt, normale Stelle in der Liste (entschieden). Block 2 und 5 zeigen dann dieselbe Zeile.

Daten: Alle Blöcke lassen sich aus dem Statusprotokoll und den Funktionen in `src/lib/report/` ableiten. Neu zu berechnen sind nur die Stunden je Dienst und Tag für Block 4. Neue Felder in der Datenbank entstehen nicht.

## 5. Excel

Drei Blätter, jeweils mit Filter in der Kopfzeile und fixierter Kopfzeile. Ziel: Eine Person filtert nach „ihren“ Gruppen (entschieden).

| Blatt | Zeilen | Spalten |
|---|---|---|
| Dienste | ein Dienst je Zeile | Dienst, Gruppe, Zielwert, Verfügbarkeit im Zeitraum, je Monat der letzten 12 ein Wert, Ausfalldauer, Anzahl Ausfälle, längster Ausfall, Dauer Eingeschränkt, Dauer Wartung |
| Ausfälle | ein Ausfall je Zeile | Dienst, Gruppe, Beginn, Ende, Dauer in Minuten, Art (Teilausfall, Schwerer Ausfall) |
| Hinweise | eine Fußnote je Zeile | Parameter des Berichts (Zeitraum, Rechenart, Wartungsart) und die Fußnoten der Berichtsseite |

Das Blatt „Ausfälle“ ist ein Vorschlag des Verfassers (Abschnitt 8, Punkt 3).

## 6. Technik

Die Berichtsseite ist React und HTML. Die Bilder entstehen aus SVG, das auf dem Server erzeugt wird.

| Aufgabe | Lösung | Begründung |
|---|---|---|
| Grafiken | SVG-Funktionen in `src/lib/report/export/`, getrennt von der Bildschirmansicht | Die Wärmekarte der Seite ist HTML und lässt sich nicht als Bild ausgeben. Ein Browser kommt nicht in Frage (Anti-Ziel). |
| PNG | `sharp` (0.35.3, schon Abhängigkeit) | Kein neues Werkzeug im Image. |
| Schrift | Eine Schrift im Image installieren (`apk add fontconfig` und eine Schriftfamilie) | Das Image `node:24-alpine` hat keine Schriften, `sharp` zeichnet sonst keinen Text. Dockerfile-Änderung, die Prüfung im Image gehört in die Abnahme. |
| Excel | `exceljs` | Reines JavaScript, per npm hinter dem Firmenproxy installierbar. |
| PDF | Bibliothek nach Wahl des Bauenden (z. B. `pdfkit`) | Seiten mit Kopfzeile, den Blöcken als Bild und den Fußnoten als Text. Seitenumbruch zwischen den Blöcken, nie mitten durch ein Bild. |
| ZIP | Bibliothek nach Wahl des Bauenden, Antwort als Datenstrom | Bei 36 Gruppen etwa 200 Bilder. |

**Speicher:** Das Rendern läuft Gruppe für Gruppe nacheinander. Jedes Bild geht in den ZIP-Datenstrom und wird freigegeben. Vor dem Bau des Images wird der Export mit allen 166 Diensten auf Test (768 MiB) gemessen, Aufruf nacheinander und zweimal gleichzeitig (Lehre aus Image 10c).

**Zugriff:** Eine Route unter `/api/availability-report/export` nimmt dieselben Parameter wie die Berichtsseite (`src/lib/report/params.ts`) und ein Format (`zip`, `pdf`, `xlsx`). Ohne Anmeldung antwortet sie mit 401, wie die Route `/api/availability-report`.

**Schnittstelle für den Mailversand:** Der Export liefert seine Dateien über eine Funktion, die Name und Inhalt je Datei zurückgibt. Route und späterer Mailversand rufen dieselbe Funktion auf. Anhänge dieser Größe können Postfix-Grenzen überschreiten, das klärt das Issue zum Mailversand.

**Schaltflächen** auf der Berichtsseite über den Tabs: „Alles herunterladen (ZIP)“, daneben „PDF“ und „Excel“. Im Gruppentab zusätzlich „Nur diese Gruppe herunterladen“.

## 7. Teile und Reihenfolge

1. **Gruppenblatt** auf der Berichtsseite, mit Block 3 und 4, Wärmekarte mit 12 Zeilen je Bild (neues Issue, Verweis auf Issue #46).
2. **Export** (Issue #50): SVG-Erzeugung der Blöcke, PNG, PDF, Excel, ZIP, Route, Schaltflächen, Schrift im Image.
3. **Mailversand** mit Empfängerfeldern (neues Issue, nach dem Export).
4. **Erweiterte Kennzahlen** (Abschnitt 9): Konzept in eigener Sitzung.

Die Dokumentation (Handbuch `docs/src/admin/availability-report.md`) wird in Teil 1 und 2 ergänzt.

## 8. Festlegungen des Verfassers (zum Prüfen)

1. **Zeitraum der Blöcke 3 und 4:** Beide zeigen den **letzten Monat des gewählten Zeitraums**, der Titel nennt den Monat. Bei einem Quartal zeigen sie also den dritten Monat. Grund: Die Monatszahlen gehen in die PowerPoint. Alternative: Block 3 summiert den ganzen Zeitraum.
2. **Gruppenwahl auf der Berichtsseite:** Das Auswahlfeld „Gruppe“ entfällt. An seine Stelle tritt der Tab „Gruppenberichte“ (Abschnitt 4). Die bisherige Ansicht „Dienste der Gruppe“ entfällt, ihre Inhalte stecken in Block 2 und 5 des Gruppenblatts.
3. **Excel-Blatt „Ausfälle“** (jeder einzelne Ausfall mit Beginn und Ende) ist ergänzt, weil es sich aus `outages` ohne Mehraufwand ergibt.
4. **Gruppen ohne Dienste** erhalten kein Blatt. Die ZIP-Datei enthält immer alle Gruppen. Nur-eine-Gruppe-Download aus dem Gruppentab liefert `gruppen/<gruppe>/` ohne `gesamt/` und ohne PDF.
5. **Bildbreite** mindestens 2000 px.
6. **Dateikopf-Konvention** (Skill `datei-kopf-konvention`) gilt für neue Quelldateien.

## 9. Eigene Sitzung: Ideen zur Kennzahlenerweiterung

Von Frank am 12.11.2026 eingebracht (MTBF, MTTR, Vorfallzahl, Tacho, Status-Kalender, Pareto, gestapelter Balken). Einordnung:

- **Mit vorhandenen Daten machbar:** Anzahl Vorfälle, MTTR (Ausfalldauer geteilt durch Anzahl), MTBF, Tacho, Status-Kalender, gestapelter Balken Betrieb/Wartung/Störung, Pareto nach Dienst.
- **Braucht neue Felder:** Pareto nach Ursache (Auswahlfeld „Ursache“ am Vorfall, 165 Altvorfälle von Hand einordnen), Verfügbarkeit gegen vereinbarte Servicezeit (Feld am Dienst, ändert alle Prozentwerte).
- **Grenzen:** MTTR misst bis „behoben“, der echte Fehlerbeginn ist nicht erfasst. MTBF ist bei 0 oder 1 Ausfall nicht aussagekräftig.

## 10. Offene Prüfpunkte vor dem Bau

- Schrift: welche Familie, welche Lizenz, wie sie im Image ankommt (Dockerfile, Build hinter dem Firmenproxy).
- Messung des Speicherbedarfs mit 166 Diensten auf Test.
- Größe der ZIP-Datei bei 36 Gruppen (relevant für den Mailversand).
