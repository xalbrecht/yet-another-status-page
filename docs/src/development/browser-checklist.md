# Browser-Prüfliste Lagebild

Diese Liste prüft das Lagebild im Browser, nachdem ein neues Image auf Dev oder Test läuft. Die automatischen Tests (siehe [Testing](./testing.md)) decken Mobilansicht, deutsche Oberfläche und deutsche Zeitformate nicht ab. Diese Punkte prüft ein Mensch.

Pro Punkt zuerst auf Dev, dann auf Test prüfen. Häkchen (✓) setzen, Auffälligkeiten in die Spalte „Notiz“ schreiben.

| Feld | Eintrag |
|---|---|
| Image-Tag | |
| Datum | |
| Prüfer | |
| Dev-Adresse | |
| Test-Adresse | |

## 1. Variante A: Startseite

| Nr. | Prüfpunkt | So prüfen | Erwartung | Dev | Test | Notiz |
|---|---|---|---|---|---|---|
| A1 | Gruppen und Icons | Startseite öffnen, alle Gruppen durchsehen | 36 Gruppen, jede mit eigenem Icon. Kein Quadratraster-Symbol (Standard-Icon `LayoutGrid`) bei Gruppen, die ein anderes Symbol haben sollten | ☐ | ☐ | |
| A2 | Dienste je Gruppe aufklappen | Eine Gruppe mit mehreren Diensten anklicken, danach erneut | Dienste erscheinen, zweiter Klick klappt zu | ☐ | ☐ | |
| A3 | Balken und Tooltip | Mit der Maus über einzelne Striche fahren | Balken aus 144 Strichen. Der Tooltip zeigt nur eine Endzeit | ☐ | ☐ | |
| A4 | Balken auf 24 Stunden | Auswahl „Balken“ auf 24 Stunden stellen (oder `?balken=24` anhängen), über den Strich ganz links fahren | Weiterhin 144 Striche (10 Minuten je Strich). Tooltip links nennt „gestern“ mit Uhrzeit, z. B. „gestern 21:20“ | ☐ | ☐ | |
| A5 | Uhrzeit stimmt mit Ortszeit | Tooltip des letzten Strichs mit der Uhr des Rechners vergleichen | Abweichung höchstens 10 Minuten. Eine Stunde Unterschied wäre ein Zeitzonenfehler | ☐ | ☐ | |
| A6 | Rückschau umschalten | Nacheinander 14, 30, 90, 180 und 365 Tage wählen (oder `?rueckschau=30`) | Verfügbarkeit je Dienst ändert sich, Adresse enthält den Parameter, kein Fehler bei 365 | ☐ | ☐ | |
| A7 | „seit …“ bei kurzem Protokoll | Rückschau 365 Tage wählen, Dienste ansehen | Unter der Prozentzahl steht „seit TT.MM.JJJJ“, wo das Protokoll kürzer ist als der gewählte Zeitraum | ☐ | ☐ | |
| A8 | Verfügbarkeitswerte plausibel | Zwei oder drei Dienste mit bekannten Vorfällen suchen, Wert gegen die Vorfallliste halten | Wert zwischen 0 und 100 %. Dienst ohne Störung zeigt 100 %. „Eingeschränkt“ und „Wartung“ zählen als verfügbar | ☐ | ☐ | |

## 2. Variante B (nur bei Testmodus „Beide“)

| Nr. | Prüfpunkt | So prüfen | Erwartung | Dev | Test | Notiz |
|---|---|---|---|---|---|---|
| B1 | Variante B anzeigen und aufklappen | Kacheln ansehen, eine Gruppe aufklappen | Kacheln mit Balken, Aufklappen zeigt die Dienste. Seite lädt ohne spürbare Verzögerung | ☐ | ☐ | |

## 3. Admin-Vorgaben

| Nr. | Prüfpunkt | So prüfen | Erwartung | Dev | Test | Notiz |
|---|---|---|---|---|---|---|
| C1 | Vorgabe wirkt auf die Startseite | Unter `/admin` Zeitraum des Balkens oder Rückschau ändern, Startseite neu laden | Neue Vorgabe sichtbar, spätestens nach 60 Sekunden (Zwischenspeicher). Werte danach zurücksetzen | ☐ | ☐ | |
| C2 | Besucherauswahl schlägt Vorgabe | Bei geänderter Vorgabe `?balken=` oder `?rueckschau=` anhängen | Die Adresszeile gewinnt gegen die Admin-Vorgabe | ☐ | ☐ | |
| C3 | Änderung an einem Dienst sofort sichtbar | Status eines Testdienstes ändern, Startseite neu laden | Änderung ohne 60 Sekunden Wartezeit sichtbar. Status danach zurücksetzen | ☐ | ☐ | |
| C4 | Icon bei neuer Gruppe | Unter `/admin` eine Gruppe anlegen | Das Feld „Icon“ steht auf `LayoutGrid` und lässt sich ändern. Testgruppe danach löschen | ☐ | ☐ | |

## 4. Handy

| Nr. | Prüfpunkt | So prüfen | Erwartung | Dev | Test | Notiz |
|---|---|---|---|---|---|---|
| D1 | Bedienung am Handy | Startseite am Handy öffnen (Test nur im Firmennetz oder per VPN) | Kein seitliches Scrollen. Aufklappen funktioniert. Tooltip erscheint beim Tippen auf einen Strich | ☐ | ☐ | |

## 5. Wiederholtes Laden

| Nr. | Prüfpunkt | So prüfen | Erwartung | Dev | Test | Notiz |
|---|---|---|---|---|---|---|
| E1 | Neuladen unter Last | Startseite 20 Mal mit F5 neu laden, auch in zwei Tabs | Immer HTTP 200, jeder Aufruf unter 1 Sekunde, keine Fehlerseite | ☐ | ☐ | |

## 6. Nur Betrieb (Shell-Zugriff nötig)

Diese Punkte führt der Betrieb aus, nicht der Prüfer im Browser.

| Nr. | Prüfpunkt | Befehl | Erwartung | Dev | Test | Notiz |
|---|---|---|---|---|---|---|
| F1 | Kein Neustart des Containers | Test: `ssh <test-host> "docker inspect -f '{{.RestartCount}}' yasp-app"` | Ausgabe `0` | ☐ | ☐ | |
| F2 | Kein Speicher-Kill | Test: `ssh <test-host> "docker events --since 24h --until 0s --filter event=oom"` | Keine Ausgabe | ☐ | ☐ | |
| F3 | Prüfskript für den Stack | `scripts/check_stack.sh` im Deployment-Projekt ausführen | Läuft ohne Fehler durch | ☐ | ☐ | |

## PDF erzeugen

Aus dem Verzeichnis des Repos. Die Ausgabe liegt im Querformat vor, damit die Tabellen lesbar bleiben:

```bash
pandoc docs/src/development/browser-checklist.md \
  --from gfm --to html5 --standalone --metadata pagetitle="Browser-Prüfliste Lagebild" \
  --pdf-engine=weasyprint --css docs/pdf/checklist.css \
  -o browser-checklist.pdf
```

Die Datei `browser-checklist.pdf` ist nicht versioniert. Zum Ausfüllen am Bildschirm oder auf Papier an Prüfer geben.
