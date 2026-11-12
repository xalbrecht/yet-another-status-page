# Störung, Benachrichtigung und Wartung: geprüfter Ist-Stand

Stand 12.11.2026. Issue #53 im Fork (GitHub). Zugehörig zu Issue #46 (Verfügbarkeitsbericht).

Dieses Dokument sammelt die Beobachtungen von Frank Albrecht aus dem Admin-Dialog und prüft sie gegen den Quelltext. Es ist die Grundlage für das Handbuch von Admins und Servicedesk und für BPMN-Prozessmodelle. Jede Aussage nennt ihre Quelle. „Ist“ beschreibt, was YASP heute tut. „Wunsch“ beschreibt, was Frank sich vorstellt und noch nicht entschieden ist.

Quellen: `src/collections/Incidents.ts`, `src/collections/Maintenances.ts`, `src/collections/Services.ts`, `src/collections/ServiceStatusEvents.ts`, `src/collections/Notifications.ts`, `src/lib/service-status-sync.ts`, `src/lib/lagebild.ts`, `docs/src/admin/services.md`.

## 1. Begriffe

| Begriff | Bedeutung | Werte | Feld |
|---|---|---|---|
| **Auswirkung** | Zustand, den die betroffenen Dienste während der Störung bekommen | Eingeschränkt, Teilausfall, Schwerer Ausfall | `incidents.impact` (Standard: Eingeschränkt) |
| **Status der Störung** | Stand der Bearbeitung | Untersuchung, Ursache gefunden, Beobachtung, Behoben | je Aktualisierung `incidents.updates[].status`, an der Störung `incidents.status` (nur lesbar, übernommen aus der letzten Aktualisierung) |
| **Zustand des Dienstes** | aktueller Zustand eines Dienstes | Betriebsbereit, Eingeschränkt, Teilausfall, Schwerer Ausfall, Wartung | `services.status` |
| **Wartungsstatus** | Stand einer Wartung | Geplant, Läuft, Abgeschlossen, Abgebrochen | `maintenances.status` |
| **Statusprotokoll** | Liste der Zeitpunkte, zu denen ein Dienst seinen Zustand gewechselt hat | wie Zustand des Dienstes | Collection `service-status-events` |
| **Benachrichtigung** | Entwurf einer Meldung an Abonnenten | Entwurf, Geplant (Zwischenstand während des Versands, kein zeitgesteuerter Versand), Gesendet, Fehlgeschlagen | Collection `notifications` |

Es gibt keine weitere Zustandstabelle. Der aktuelle Zustand steht im Dienst (`services.status`). Der Verlauf steht im Statusprotokoll. Das Lagebild und der Bericht rechnen den Zustand zu einem beliebigen Zeitpunkt aus dem Protokoll.

## 2. Störung

### 2.1 Erfassen (Ist)

Pflichtangaben: Titel, mindestens eine Aktualisierung (Status, Nachricht, Zeitpunkt). Betroffene Dienste und Auswirkung sind Felder des Dialogs. Der Zeitpunkt der Aktualisierung ist mit „jetzt“ vorbelegt und änderbar.

Folgen beim Speichern:
1. Eine Kurz-ID wird erzeugt (Adresse `/i/<Kurz-ID>`).
2. Der Status der Störung übernimmt den Status der letzten Aktualisierung.
3. Jeder betroffene Dienst bekommt als Zustand die schlechteste Auswirkung aller seiner offenen Störungen. Wechselt der Zustand, entsteht ein Eintrag im Statusprotokoll.
4. Eine Benachrichtigung entsteht als Entwurf (Abschnitt 4).

„Offen“ heißt: Status der Störung ist nicht „Behoben“.

### 2.2 Aktualisieren (Ist)

Eine neue Aktualisierung kommt ans Ende der Liste. Der Status der Störung wechselt auf den Status der neuen Aktualisierung. Der Zustand der Dienste bleibt unverändert, solange die Auswirkung gleich bleibt und der Status nicht „Behoben“ ist. Eine Benachrichtigung entsteht als Entwurf.

### 2.3 Auswirkung ändern, solange die Störung offen ist (Ist)

Der Dialog erlaubt nur Eingeschränkt, Teilausfall oder Schwerer Ausfall. „Betriebsbereit“ ist keine Auswahl. Die Änderung setzt den Zustand der Dienste neu (schlechteste Auswirkung aller offenen Störungen) und schreibt einen Eintrag.

Die Auswirkung gilt für die ganze Störung. Eine Störung hat keinen Verlauf der Auswirkung. Ein Workaround, der von Schwerer Ausfall auf Eingeschränkt mildert, lässt sich heute nur abbilden, indem die Auswirkung ab dem Zeitpunkt der Änderung ersetzt wird.

### 2.4 Beheben (Ist)

„Betriebsbereit“ entsteht nur durch eine Aktualisierung mit Status „Behoben“. Dann gilt:
1. `resolvedAt` der Störung ist der Zeitpunkt dieser Aktualisierung.
2. Die Dienste bekommen den Zustand aus den übrigen offenen Störungen, sonst „Betriebsbereit“. Ein Dienst, der von Hand auf „Wartung“ steht und keine offene Störung hat, bleibt in „Wartung“.
3. Der Wechsel steht im Statusprotokoll. Eine Benachrichtigung entsteht als Entwurf.

### 2.5 Wiedereröffnen (Ist)

Eine neue Aktualisierung mit einem anderen Status als „Behoben“ löscht `resolvedAt`. Die Störung ist wieder offen, die Dienste bekommen wieder die Auswirkung, es entsteht ein Eintrag.

### 2.6 Auswirkung, Dienste oder Zeiten nach dem Beheben ändern (Ist)

Das Statusprotokoll ändert sich **nicht**. Der Zustand der Dienste wird nur aus offenen Störungen berechnet, die behobene Störung zählt nicht mehr. Bericht und Lagebild zeigen den alten Verlauf weiter.

Ausnahme: Entfernen Sie einen Dienst aus der Störung, wird er neu bewertet und bekommt gegebenenfalls einen neuen Eintrag, der frühere Verlauf bleibt.

### 2.7 Löschen (Ist)

Angemeldete Nutzer dürfen Störungen löschen (`standardAccess`). Beim Löschen passiert:
1. Die Aktualisierungen und die Verknüpfungen zu den Diensten werden mit gelöscht.
2. Die Dienste werden neu bewertet. Ohne andere offene Störung wechseln sie auf „Betriebsbereit“, das ergibt einen Eintrag zum Zeitpunkt des Löschens.
3. Benachrichtigungen bleiben bestehen, ihre Verknüpfung zur Störung entfällt (Datenbank: `ON DELETE SET NULL`).
4. Die **früheren Einträge im Statusprotokoll bleiben**. Der Bericht zählt die Zeit der gelöschten Störung weiter als Ausfall.

### 2.8 Zeitpunkt der Einträge (Ist)

Ein Protokolleintrag trägt den Zeitpunkt des **Speicherns** (`changedAt = jetzt`). Er trägt nicht den Zeitpunkt einer Aktualisierung. Wer den Zeitpunkt einer Aktualisierung von Hand ändert, ändert nur die Anzeige und `resolvedAt`, nicht den Eintrag im Protokoll.

## 3. Zustand eines Dienstes von Hand setzen (Ist)

Im Admin lässt sich bei jedem Dienst der Zustand wählen. Folgen:
- Es entsteht ein Eintrag im Protokoll (nur bei echter Änderung).
- Statusseite und Lagebild zeigen den neuen Zustand. Das Lagebild lädt neu.
- Es geht keine Meldung an Abonnenten.
- Der Zustand hält bis zur nächsten Änderung einer Störung, die diesen Dienst betrifft. Dann wird er aus den offenen Störungen neu berechnet, ohne offene Störung wird er „Betriebsbereit“ (oder bleibt „Wartung“).

## 4. Benachrichtigung

### 4.1 Entstehen (Ist)

Es entsteht **automatisch** ein Entwurf:
- beim Erfassen einer Störung (aus der ersten Aktualisierung),
- bei jeder neuen Aktualisierung einer Störung mit Nachricht,
- beim Anlegen einer Wartung und bei jeder neuen Aktualisierung einer Wartung.

Keine Entwürfe entstehen bei der automatischen Statusumstellung einer Wartung nach Zeitplan.

Ein Entwurf enthält Titel, Betreff, Kanal („Beide“ = E-Mail und SMS), Text für E-Mail und Text für SMS und die Verknüpfung zur Störung samt Nummer der Aktualisierung (`updateIndex`).

### 4.2 Texte (Ist)

- **SMS:** aus einer bearbeitbaren Vorlage mit Platzhaltern `{{siteName}}`, `{{title}}`, `{{status}}`, `{{message}}` und `{{url}}`. Die Vorlagen für neue Störung und Aktualisierung stehen in den SMS-Einstellungen, ebenso die Höchstlängen für Titel und Nachricht (Standard 50 und 100 Zeichen).
- **E-Mail:** Aufbau fest im Quelltext aus Übersetzungstexten („Neue Störung“, „Status“, Nachricht, Link). Keine Vorlage zum Bearbeiten.

### 4.3 Versand (Ist)

Der Versand geschieht **von Hand** über die Schaltfläche in der Benachrichtigung (Collection „Benachrichtigungen“, Route `send-from-collection`). Einen zeitgesteuerten Versand gibt es nicht. Empfänger der E-Mail sind Abonnenten, die aktiv, vom Betreiber freigegeben und per Link bestätigt sind (PR #43). SMS ist gesperrt, weil kein Anbieter eingerichtet ist.

## 5. Wartung

### 5.1 Anlegen und Ablauf (Ist)

Eine Wartung hat Titel, betroffene Dienste, geplanten Beginn und geplantes Ende, die Haken „Auto-start on schedule“ und „Auto-complete on schedule“ (beide Standard an) und Aktualisierungen (Status, Nachricht).

Der Wartungsstatus wechselt auf zwei Wegen:
1. **Von Hand:** über eine neue Aktualisierung mit Status und Nachricht. Der Wartungsstatus übernimmt die letzte Aktualisierung. „Abgeschlossen“ setzt `completedAt`, „Abgebrochen“ setzt `cancelledAt`.
2. **Nach Zeitplan:** wird der geplante Beginn oder das geplante Ende erreicht, wechselt der Status auf „Läuft“ oder „Abgeschlossen“. Das geschieht aber nur, **wenn jemand die Wartung oder die Startseite liest**, und wird dann gespeichert. Es gibt keinen Zeitgeber (Issue #52 im Fork).

### 5.2 Wirkung auf die Dienste (Ist)

Keine. Wartungen ändern den Zustand der Dienste nicht (Dokumentation `docs/src/admin/services.md`). „Wartung“ als Zustand wird von Hand am Dienst gesetzt und von Hand zurückgesetzt. YASP merkt sich keinen vorherigen Zustand.

Ist beim Setzen von „Wartung“ schon eine Störung offen, bestimmt deren Auswirkung den Zustand, weil die Berechnung aus offenen Störungen den Zustand „Wartung“ überschreibt. Nach dem Beheben ist der Dienst „Betriebsbereit“ und nicht wieder „Wartung“.

### 5.3 Benachrichtigung (Ist)

Beim Anlegen und bei jeder von Hand geschriebenen Aktualisierung entsteht ein Entwurf. Die automatische Umstellung nach Zeitplan erzeugt keinen Entwurf.

## 6. Statusprotokoll und Bericht

### 6.1 Wer schreibt (Ist)

Es schreibt nur die Collection „Dienste“ (`afterChange`), und zwar bei jeder Änderung des Zustands. Auslöser sind: Änderung einer Störung (über die Berechnung aus offenen Störungen), Änderung am Dienst von Hand, Neuanlage eines Dienstes. Die Nachrechnung vor dem 10.11.2026 (Issue #48 im Fork) schreibt Einträge mit Quelle „nachgerechnet“.

Im Admin lässt sich ein Eintrag weder anlegen noch bearbeiten (`create` und `update` gesperrt, für alle Einträge). Löschen dürfen angemeldete Nutzer.

### 6.2 Wie der Bericht rechnet (Ist)

Ein Zustand gilt von seinem Eintrag bis zum nächsten. Verfügbarkeit = Anteil der bekannten Zeit ohne Teilausfall und Schwerer Ausfall. Eingeschränkt und Wartung zählen als verfügbar und stehen als eigene Zeilen (Konzept 4.1). Der Bericht liest keine Störungen, nur das Protokoll.

## 7. Korrekturen zu den Annahmen

| Annahme | Befund |
|---|---|
| Eine Benachrichtigung bei Aktualisierung einer Störung gibt es nicht. | Sie existiert: ein Entwurf entsteht bei jeder neuen Aktualisierung mit Nachricht. Versandt wird von Hand. |
| Beim Beenden einer Wartung setze ich keinen Status. | Richtig: Wartungsstatus und Zustand des Dienstes sind getrennt. Wartungen setzen keinen Zustand am Dienst. |
| Beim Löschen einer Störung entfallen die zugehörigen Einträge. | Heute nicht: Die früheren Einträge bleiben, nur der Zustand wird neu berechnet. |
| Die Auswirkung hängt am Status der Störung. | Nein: Sie hängt an der Störung als Ganzes. Nur der Status der Störung wechselt je Aktualisierung. |

## 8. Lücken im Ist-Stand

1. Nachträgliche Änderungen an einer behobenen Störung wirken nicht auf Protokoll und Bericht (2.6).
2. Das Löschen einer Störung lässt ihre Einträge stehen (2.7).
3. Der Zeitpunkt eines Eintrags ist der Zeitpunkt des Speicherns (2.8).
4. Die Auswirkung hat keinen Verlauf. Ein Workaround ab einem bestimmten Zeitpunkt ist nur durch Ersetzen der Auswirkung abbildbar (2.3).
5. Wartungen setzen den Zustand der Dienste nicht, und nach Zeitplan werden sie nur beim Lesen umgestellt, ohne Meldung (5.1, 5.2, Issue #52).
6. „Wartung“ als Zustand und seine Rückkehr werden von Hand gepflegt (3, 5.2).

## 9. Wünsche von Frank (noch nicht entschieden)

1. Der Zustand eines Dienstes lässt sich nicht mehr von Hand setzen. Zustandsänderungen entstehen nur durch Aktionen (Störung, Wartung).
2. Eine nachträgliche Änderung der Auswirkung einer behobenen Störung passt das Protokoll an, und der Bericht rechnet neu.
3. Beim Ändern der Auswirkung gibt es zwei Bedeutungen: **Korrektur** („war schon immer so, ich habe falsch eingeschätzt“, gilt ab der Ersterfassung) oder **Veränderung** (gilt ab der Aktualisierung, zum Beispiel Workaround). Tendenz: Standard ist „ab dem Zeitpunkt der Aktualisierung“. Wählbar sind Ersterfassung, eine bestimmte Aktualisierung oder jetzt.
4. Das Löschen einer Störung entfernt die zugehörigen Einträge im Protokoll, der Bericht passt sich an.
5. Das Protokoll wird verändert (Einträge angepasst, neu angelegt, gelöscht) und ist damit die einzige Datenbasis der Berechnung. Keine Berechnung aus den Störungen.
6. Beim Aktualisieren einer Störung soll ein versendbarer Benachrichtigungsentwurf entstehen (besteht schon, siehe Abschnitt 7).
7. Benachrichtigungsvorlagen bearbeitbar (Konsole oder Admin) und je Störung auswählbar.
8. ntfy als dritter Kanal neben E-Mail und SMS. Die aktiven Kanäle und die Konfiguration von ntfy (Tokens, Upstream) im Admin einstellbar.
9. Wartungen melden Beginn und Ende an die Abonnenten (Issue #52 im Fork).
10. Wartung läuft parallel zum Zustand. Die Statusseite zeigt eine laufende oder in 24 Stunden beginnende Wartung neben dem Zustandspunkt (Issue #54 im Fork, umgesetzt). Der Zustand „Wartung“ am Dienst bleibt Anzeige, der Zeitgeber setzt ihn später (Issue #52). Der Bericht nimmt die Wartungszeit aus den erfassten Wartungen und bietet drei Berechnungsarten (Konzept 4.7).
11. Die Wartungszeit für den Bericht ist die tatsächliche Zeit, soweit erfasst, sonst die geplante Zeit (Tabelle im Konzept, Abschnitt 4.8). Die Tabelle gehört in das Handbuch.

## 10. Bausteine für BPMN-Modelle (Vorschlag)

Beteiligte: Servicedesk oder Admin (erfasst, aktualisiert), System (YASP: berechnet Zustand, schreibt Protokoll, erzeugt Entwurf), Abonnent (empfängt). Die Rollen sind ein Vorschlag, keine Festlegung.

| Prozess | Start | Schritte | Ende |
|---|---|---|---|
| P1 Störung erfassen und melden | Meldung über eine Störung | Titel, Dienste, Auswirkung, erste Aktualisierung eintragen. System setzt Zustand, schreibt Eintrag, erzeugt Entwurf. Entwurf prüfen und senden. | Abonnenten informiert |
| P2 Störung aktualisieren | neue Erkenntnis | Aktualisierung mit Status und Nachricht. Gegebenenfalls Auswirkung ändern. Entwurf prüfen und senden. | Abonnenten informiert |
| P3 Störung beheben | Ursache beseitigt | Aktualisierung mit Status „Behoben“. System setzt Zustand zurück. Entwurf senden. | Dienst betriebsbereit |
| P4 Störung korrigieren (Wunsch) | Fehleinschätzung erkannt | Auswirkung ändern, Wirkungszeitpunkt wählen, System schreibt Protokoll neu | Bericht angepasst |
| P5 Wartung planen und durchführen | geplante Arbeit | Wartung anlegen, Entwurf senden, zum Beginn Aktualisierung „Läuft“ und Zustand der Dienste auf „Wartung“, zum Ende „Abgeschlossen“ und Zustand zurück, Entwurf senden | Dienst betriebsbereit |
