# Browser-Prüfliste Lagebild

Diese Liste prüft das Lagebild im Browser, nachdem ein neues Image auf Dev oder Test läuft. Die automatischen Tests (siehe [Testing](./testing.md)) laufen gegen `next dev`, nicht gegen das Image. Sie prüfen Inhalte und Logik, nicht die Optik im echten Browser, die Oberfläche des Admin-Bereichs, den echten Mailserver, die Schriften im Image und die Zeitzone des Rechners. Diese Punkte prüft ein Mensch. Was ein Test schon abdeckt, steht in der Spalte „Automatisch“, der Rest der Zeile bleibt von Hand. Punkte, die ein Test ganz abdeckt, stehen im Abschnitt „Entfallen“ am Ende, ihre Nummern bleiben vergeben.

Englische Fassung mit denselben Nummern: [Browser Checklist (English)](./browser-checklist.en.md).

Pro Punkt zuerst auf Dev, dann auf Test prüfen. Häkchen (✓) setzen, Auffälligkeiten in die Spalte „Notiz“ schreiben.

| Feld | Eintrag |
|---|---|
| Image-Tag | |
| Datum | |
| Prüfer | |
| Dev-Adresse | |
| Test-Adresse | |

## 1. Variante A: Startseite

| Nr. | Prüfpunkt | So prüfen | Erwartung | Automatisch | Dev | Test | Notiz |
|---|---|---|---|---|---|---|---|
| A1 | Gruppen und Icons | Startseite öffnen, alle Gruppen durchsehen | 36 Gruppen, jede mit eigenem Icon. Kein Quadratraster-Symbol (Standard-Icon `LayoutGrid`) bei Gruppen, die ein anderes Symbol haben sollten |  | ☐ | ☐ |  |
| A3 | Balken und Tooltip | Mit der Maus über einzelne Striche fahren | Balken aus 144 Strichen. Der Tooltip zeigt nur eine Endzeit | E2E: 144 Striche, Tooltip mit Uhrzeit und Zustand. Offen: nur eine Endzeit. | ☐ | ☐ |  |
| A4 | Balken auf 24 Stunden | Auswahl „Balken“ auf 24 Stunden stellen (oder `?balken=24` anhängen), über den Strich ganz links fahren | Weiterhin 144 Striche (10 Minuten je Strich). Tooltip links nennt „gestern“ mit Uhrzeit, z. B. „gestern 21:20“ | E2E: 144 Striche, Überschrift „Letzte 24 Stunden · 10 Minuten“. Offen: Text „gestern“ im Tooltip. | ☐ | ☐ |  |
| A5 | Uhrzeit stimmt mit Ortszeit | Tooltip des letzten Strichs mit der Uhr des Rechners vergleichen | Abweichung höchstens 10 Minuten. Eine Stunde Unterschied wäre ein Zeitzonenfehler |  | ☐ | ☐ |  |
| A6 | Rückschau umschalten | Nacheinander 14, 30, 90, 180 und 365 Tage wählen (oder `?rueckschau=30`) | Verfügbarkeit je Dienst ändert sich, Adresse enthält den Parameter, kein Fehler bei 365 | E2E: 14, 90 und 180 Tage, ungültiger Wert, Adresse. Offen: 30 und 365 Tage, Fehlerfreiheit bei 365. | ☐ | ☐ |  |
| A7 | „seit …“ bei kurzem Protokoll | Rückschau 365 Tage wählen, Dienste ansehen | Unter der Prozentzahl steht „seit TT.MM.JJJJ“, wo das Protokoll kürzer ist als der gewählte Zeitraum | Unit (`all-groups-panel`): „seit …“ im Feld „Alle“. Offen: Anzeige bei den einzelnen Diensten. | ☐ | ☐ |  |
| A8 | Verfügbarkeitswerte plausibel | Zwei oder drei Dienste mit bekannten Vorfällen suchen, Wert gegen die Vorfallliste halten | Wert zwischen 0 und 100 %. Dienst ohne Störung zeigt 100 %. „Eingeschränkt“ und „Wartung“ zählen als verfügbar |  | ☐ | ☐ |  |

## 2. Variante B (nur bei Testmodus „Beide“)

| Nr. | Prüfpunkt | So prüfen | Erwartung | Automatisch | Dev | Test | Notiz |
|---|---|---|---|---|---|---|---|
| B1 | Variante B anzeigen und aufklappen | Kacheln ansehen, eine Gruppe aufklappen | Kacheln mit Balken, Aufklappen zeigt die Dienste. Seite lädt ohne spürbare Verzögerung | E2E: Klick klappt die Dienste mit Balken und Verfügbarkeit auf. Offen: Ladezeit. | ☐ | ☐ |  |

## 3. Admin-Vorgaben

| Nr. | Prüfpunkt | So prüfen | Erwartung | Automatisch | Dev | Test | Notiz |
|---|---|---|---|---|---|---|---|
| C1 | Vorgabe wirkt auf die Startseite | Unter `/admin` Zeitraum des Balkens oder Rückschau ändern, Startseite neu laden | Neue Vorgabe sichtbar, spätestens nach 60 Sekunden (Zwischenspeicher). Werte danach zurücksetzen | E2E: Vorgabe über die Schnittstelle gesetzt, Startseite folgt. Offen: Eingabe im Admin-Formular. | ☐ | ☐ |  |
| C4 | Icon bei neuer Gruppe | Unter `/admin` eine Gruppe anlegen | Das Feld „Icon“ steht auf `LayoutGrid` und lässt sich ändern. Testgruppe danach löschen |  | ☐ | ☐ |  |

## 4. Handy

| Nr. | Prüfpunkt | So prüfen | Erwartung | Automatisch | Dev | Test | Notiz |
|---|---|---|---|---|---|---|---|
| D1 | Bedienung am Handy | Startseite am Handy öffnen (Test nur im Firmennetz oder per VPN) | Kein seitliches Scrollen. Aufklappen funktioniert. Tooltip erscheint beim Tippen auf einen Strich | E2E: bei 375 und 768 Pixel nicht breiter als das Fenster, Touch (Tooltip, Dienstfeld). Offen: echtes Gerät. | ☐ | ☐ |  |

## 5. Wiederholtes Laden

| Nr. | Prüfpunkt | So prüfen | Erwartung | Automatisch | Dev | Test | Notiz |
|---|---|---|---|---|---|---|---|
| E1 | Neuladen unter Last | Startseite 20 Mal mit F5 neu laden, auch in zwei Tabs | Immer HTTP 200, jeder Aufruf unter 1 Sekunde, keine Fehlerseite |  | ☐ | ☐ |  |

## 6. Neues Layout (A und B)

Gilt für Variante A, Variante B und den Testmodus „Beide“. Die Einstellungen stehen unter `/admin` bei den Website-Einstellungen im Bereich Lagebild. Änderungen wirken spätestens nach 60 Sekunden (Zwischenspeicher des Lagebilds); die Boxen selbst werden bei jedem Aufruf neu gelesen. Werte danach zurücksetzen.

| Nr. | Prüfpunkt | So prüfen | Erwartung | Automatisch | Dev | Test | Notiz |
|---|---|---|---|---|---|---|---|
| G1 | Boxen rechts bei breitem Fenster | Fenster auf mindestens 1024 Pixel Breite, Startseite öffnen | Lagebild links, rechts die Boxen „Aktuelle Störungen“ und „Wartungen“. Die lange Liste der Gruppen und Dienste fehlt, die Seite ist breiter als bei „Liste (Original)“ | E2E: Boxen vorhanden, Liste der Dienste fehlt. Offen: Anordnung rechts neben dem Lagebild ab 1024 Pixel. | ☐ | ☐ |  |
| G2 | Boxen auf dem Handy | Fenster unter 1024 Pixel schmal ziehen, Einstellung „Boxen auf schmalen Bildschirmen“ zuerst auf „Vor dem Lagebild“, dann auf „Nach dem Lagebild“ stellen | Boxen stehen je nach Einstellung über oder unter dem Lagebild. Kein seitliches Scrollen | E2E: Einstellung „after“ steht im Raster, kein seitliches Scrollen. Offen: tatsächliche Reihenfolge über oder unter dem Lagebild. | ☐ | ☐ |  |
| G4 | Blöcke unter dem Lagebild | Mit einer offenen und einer gelösten Störung laden, die Seite durchsehen | „Aktuelle Störungen“ zeigt alle offenen mit Verlauf, „Geplante Wartungen“ die Wartungen, „Vergangene Störungen“ nur gelöste der letzten 5 Tage. Ohne offene Störung steht der Satz „Keine aktuellen Störungen.“ | E2E: offene und gelöste Störungen, Grenze von 5 Tagen, Satz „Keine aktuellen Störungen.“. Offen: Block „Geplante Wartungen“. | ☐ | ☐ |  |
| G5 | Tooltip mit der Maus | Langsam über eine Kachel fahren, dann in den Tooltip, dann weg | Tooltip erscheint unter der Kachel mit den Diensten, jeder mit farbigem Punkt, ohne Beschreibung. Beim Wechsel in den Tooltip bleibt er offen und flackert nicht. Ein Klick im Tooltip zeigt das Dienstfeld. Maus weg schließt ihn nach etwa einer Viertelsekunde | E2E: Hover, Wechsel in den Tooltip, Klick zeigt das Dienstfeld, Schließen nach höchstens 500 ms. Offen: farbige Punkte, Flackern, Lage unter der Kachel. | ☐ | ☐ |  |
| G7 | Tooltip am Handy | Eine Kachel antippen, danach erneut antippen, danach neben die Kachel tippen | Erstes Tippen zeigt den Tooltip, zweites das Dienstfeld mit Balken. Tippen daneben schließt den Tooltip | E2E: erstes Tippen zeigt den Tooltip, zweites das Dienstfeld. Offen: Tippen neben die Kachel schließt den Tooltip. | ☐ | ☐ |  |
| G8 | Tooltip am Rand | Kacheln ganz links und ganz rechts mit der Maus ansteuern, auch bei schmalem Fenster | Der Tooltip bleibt im Raster und wird nicht abgeschnitten. Breite höchstens 340 Pixel |  | ☐ | ☐ |  |
| G9 | Kachel „Alle“ | Erste Kachel ansehen (Raster-Symbol, darunter „Alle“ nur einmal), anklicken, eine Zeile anklicken, mit der Maus über die Kachel fahren | Meta „n Gruppen · m betroffen“, in Variante A vorgewählt. Das Feld zeigt eine Zeile je Gruppe mit Balken und Verfügbarkeit, ein Klick auf eine Zeile wählt die Gruppe. Der Tooltip nennt die betroffenen Gruppen und „n weitere Gruppen betriebsbereit“ | E2E und Unit: Symbol, Vorauswahl in Variante A, Zeile wählt die Gruppe, Zeile je Gruppe mit Verfügbarkeit. Offen: Meta „n Gruppen · m betroffen“, Text im Tooltip. | ☐ | ☐ |  |
| G11 | Dunkelmodus | Dunkelmodus einschalten, Boxen, Streifen, Tooltip und Dienstfeld ansehen | Alles lesbar, Streifen und Punkte in den Zustandsfarben |  | ☐ | ☐ |  |
| G14 | Marke „Testmodus“ in der Kopfzeile | Im Testmodus „Beide“ die Kopfzeile ansehen, einmal breit, einmal schmal | Breit: Marke zwischen „System Status“ und „Abonnieren“, bei einer einzelnen Variante mit „Variante A“ bzw. „Variante B“, die Boxen rutschen nicht. Unter 640 Pixel Breite ist die Marke ausgeblendet | E2E: Marke in der Kopfzeile, „Variante A“ und „Variante B“. Offen: Lage zwischen „System Status“ und „Abonnieren“, Ausblenden unter 640 Pixel. | ☐ | ☐ |  |

## 7. Nur Betrieb (Shell-Zugriff nötig)

Diese Punkte führt der Betrieb aus, nicht der Prüfer im Browser.

| Nr. | Prüfpunkt | Befehl | Erwartung | Dev | Test | Notiz |
|---|---|---|---|---|---|---|
| F1 | Kein Neustart des Containers | Test: `ssh <test-host> "docker inspect -f '{{.RestartCount}}' yasp-app"` | Ausgabe `0` | ☐ | ☐ | |
| F2 | Kein Speicher-Kill | Test: `ssh <test-host> "docker events --since 24h --until 0s --filter event=oom"` | Keine Ausgabe | ☐ | ☐ | |
| F3 | Prüfskript für den Stack | `scripts/check_stack.sh` im Deployment-Projekt ausführen | Läuft ohne Fehler durch | ☐ | ☐ | |

## 8. Verfügbarkeitsbericht (Admin)

Gilt für die Seite `/admin/verfuegbarkeitsbericht` (Bericht, Export und Mailversand). Voraussetzung: Anmeldung im Admin, Dienste mit Ausfällen im gewählten Zeitraum, ein Dienst mit langem Namen, ein Dienst mit Emoji im Namen und mindestens ein Empfänger in den E-Mail-Einstellungen. Die Punkte H1 bis H11 gehören zur Berichtsansicht, H12 bis H14 zum Export, H15 bis H20 zum Mailversand. Geänderte Einstellungen danach zurücksetzen.

| Nr. | Prüfpunkt | So prüfen | Erwartung | Automatisch | Dev | Test | Notiz |
|---|---|---|---|---|---|---|---|
| H1 | Gruppenliste bleibt beim Klick stehen | Gruppenberichte öffnen, die Liste nach unten scrollen, eine Gruppe weiter unten anklicken | Das Gruppenblatt wechselt, die Liste springt nicht an den Anfang, die Seite scrollt nicht nach oben, die gewählte Gruppe ist markiert |  | ☐ | ☐ |  |
| H2 | Gruppenliste bei schmalem Fenster | Fenster unter 800 Pixel Breite ziehen, Gruppenberichte ansehen | Die Liste steht über dem Gruppenblatt in voller Breite (höchstens 40 % der Fensterhöhe, dann scrollbar), kein seitliches Scrollen |  | ☐ | ☐ |  |
| H3 | Balken bei 100 % | Gruppenblatt einer Gruppe mit einem Dienst bei 100 % ansehen (Block „Dienste der Gruppe, schwächste zuerst“), hell und dunkel | Der Balken füllt die ganze Spur in Hellblau, er sieht nicht leer aus |  | ☐ | ☐ |  |
| H4 | Dienstnamen in Block 4 | Monat mit Ausfällen eines Dienstes mit langem Namen (ab 16 Zeichen) wählen, den Block „Störungen im <Monat>, je Tag“ ansehen | Der Name steht senkrecht unter der Achse und ist nicht am unteren Rand abgeschnitten (bei Kürzung endet er mit „…“) |  | ☐ | ☐ |  |
| H11 | Vorgewählte Gruppe | Gruppenberichte ohne `group` in der Adresse öffnen, danach den Zeitraum ändern | Die schwächste Gruppe (erster Eintrag der Liste) ist gewählt, die Seite lädt ohne auffällige Wartezeit | Unit: die schwächste Gruppe ist vorgewählt. Offen: Ladezeit. | ☐ | ☐ |  |
| H14 | Bilder: Emoji und lange Namen | Einen Dienst mit Emoji im Namen und eine Gruppe mit mehr als 40 Zeichen anlegen, ZIP herunterladen | In den Bildern erscheint kein Kästchen oder „?“ für das Emoji. Der Gruppenordner im ZIP hat höchstens 40 Zeichen | Unit: PDF scheitert bei Emoji nicht, Ordnername höchstens 40 Zeichen. Offen: Emoji im Bild (hängt von den Schriften im Image ab). | ☐ | ☐ |  |
| H15 | Versand mit Tastatur | Nur mit der Tastatur: zu „Per Mail senden“ tabben, Enter. Danach „Abbrechen“ mit Enter | Der Fokus springt auf „Jetzt senden“, nach „Abbrechen“ zurück auf „Per Mail senden“, nach dem Senden auf die Meldung | Unit: Meldebereich in jedem Zustand vorhanden und fokussierbar. Offen: Fokussprung mit echter Tastatur. | ☐ | ☐ |  |
| H16 | Mailserver nicht erreichbar | Unter E-Mail-Einstellungen einen nicht erreichbaren Server eintragen, Versand starten, Wert danach zurücksetzen | Nach höchstens etwa 10 Sekunden steht „Der Mailserver antwortet nicht … Es wurde nichts gesendet.“ |  | ☐ | ☐ |  |
| H17 | Mailtext | Versand an den Auffangserver auf `<test-host>` (Oberfläche über einen SSH-Tunnel), Mail 1 öffnen | Der Text nennt „Dienste im Bericht: n“, PDF und Excel hängen an |  | ☐ | ☐ |  |
| H20 | Zwei Versände zugleich | In zwei Tabs gleichzeitig „Jetzt senden“ auslösen | Ein Tab meldet „Es läuft bereits ein Versand.“, der andere versendet normal | Unit: der zweite Versand bekommt die Sperre nicht, Meldung „läuft“. Offen: zwei Tabs gegen die echte Datenbank (der PostgreSQL-Test läuft nicht im CI). | ☐ | ☐ |  |
| H21 | Beendete Dienste ausblenden | Einen Dienst mit Ende gestern anlegen, Statusseite, Lagebild, `/api/v1/services` und den Störungsassistenten ansehen | Der Dienst fehlt überall. Eine Gruppe nur mit beendeten Diensten erscheint nicht | E2E: Statusseite, Lagebild und `/api/v1/services` zeigen nur aktive Dienste. Offen: Störungsassistent. | ☐ | ☐ |  |
| H23 | Bericht mit Schalter | Bericht mit und ohne „Beendete Dienste einbeziehen“ öffnen (Hell, Dunkel, 390 px) | Beendete Dienste erscheinen nur mit Schalter, grau, mit „beendet am …“. Die zwei Optionsfelder unterscheiden sich auch ohne Farbe (Haken gegen leerer Ring) | Unit: Ranglistenfelder, „beendet am“, graue Zeile. Offen: Optik in Hell, Dunkel und bei 390 Pixel, Unterscheidung ohne Farbe. | ☐ | ☐ |  |
| H24 | Export mit beendeten Diensten | Mit Schalter ZIP, PDF und Excel herunterladen | Rangliste mit Marken und grauer Zeile, Excel mit drei Spalten am Ende, der Schalter gilt im Export | Unit: Excel-Spalten, Bild mit zwei Marken, graue Zeile, Schalter in den Export-Adressen. Offen: Optik der heruntergeladenen Dateien. | ☐ | ☐ |  |

## 9. Entfallen, durch Tests abgedeckt

Diese Punkte prüft ein Test vollständig. Sie stehen nicht mehr in den Tabellen, ihre Nummern bleiben vergeben. Alle Tests laufen im CI (`npm run test:unit`, E2E-Job).

| Nr. | Prüfpunkt | Test |
|---|---|---|
| A2 | Dienste je Gruppe aufklappen | `lagebild.spec.ts` (Klick auf eine Kachel) |
| C2 | Besucherauswahl schlägt Vorgabe | `lagebild.spec.ts` (Rückschau und Zeitraum des Balkens: Vorgabe, Auswahl, ungültiger Wert) |
| C3 | Änderung an einem Dienst sofort sichtbar | `lagebild.spec.ts` (Statusänderung trotz Zwischenspeicher sofort sichtbar) |
| G3 | Anzahl und Inhalt der Kurzform | `status-boxes.spec.ts` (`statusBoxEntries`, `statusBoxContent`) |
| G6 | Tooltip mit Tastatur | `status-boxes.spec.ts` (Tab, Esc, `aria-describedby`), `group-tooltip.test.tsx` (Zustandstext) |
| G10 | Adresse | `lagebild.spec.ts` (Filter je Gruppe), `status-boxes.spec.ts` (Kachel „Alle“) |
| G12 | Liste (Original) unverändert | `status-boxes.spec.ts` (Variante off), `status-page.spec.ts` (Legende) |
| G13 | Variante per Adresse (nur Testmodus „Beide“) | `status-boxes.spec.ts` (Testmodus per Adresse) |
| H5 | Dezimalzeichen im Tooltip | `report-group-sheet-view.test.tsx` (Dezimalzeichen im Tooltip) |
| H6 | Kurzer Ausfall sichtbar | `report-group-sheet-view.test.tsx` (Mindesthöhe eines kurzen Ausfalls) |
| H7 | Überschrift bei Teilmonat | `report-group-sheet.test.ts` (Überschrift mit Tagen) |
| H8 | Einzahl | `report-group-sheet-view.test.tsx`, `report-default-group.test.ts` (Einzahl) |
| H9 | Felder in den Gruppenberichten | `report-view.test.tsx` (Felder der Gruppenberichte) |
| H10 | Gruppe bleibt beim Wechsel | `report-view-state.test.ts` (Gruppe bleibt beim Wechsel) |
| H12 | Dateiname bei freiem Zeitraum | `report-export-files.test.ts` (`reportBaseName`) |
| H13 | Excel: Minuten und Wartungsart B | `report-export-excel.test.ts` (Minuten, Wartungsart B) |
| H18 | Ungültige Empfängeradresse | `report-recipients.test.ts` (`validateRecipients`) |
| H19 | SMTP-Angaben abgemeldet | `email-settings-access.test.ts` (Feldzugriff anonym) |
| H22 | Löschen nur nach dem Ende | `service-delete-rule.test.ts`, `service-delete-notice.test.tsx`, `service-delete.spec.ts` |

## PDF erzeugen

Aus dem Verzeichnis des Repos. Die Ausgabe liegt im Querformat vor, damit die Tabellen lesbar bleiben:

```bash
pandoc docs/src/development/browser-checklist.md \
  --from gfm --to html5 --standalone --metadata pagetitle="Browser-Prüfliste Lagebild" \
  --pdf-engine=weasyprint --css docs/pdf/checklist.css \
  -o browser-checklist.pdf
```

Die Datei `browser-checklist.pdf` ist nicht versioniert. Zum Ausfüllen am Bildschirm oder auf Papier an Prüfer geben.
