# Sprachdateien: Oberflächensprache per Einstellung wählen

Stand 14.11.2026, Entwurf. Issue #60 im Fork (GitHub), Meilenstein „Internationalisierung“. Fasst Issue #11 (Sprache im Admin umschaltbar) mit zusammen. Berührt Issue #61 (Abstimmung mit dem Upstream).

Entscheidungen von Frank Albrecht sind als „entschieden“ gekennzeichnet. Eigene Festlegungen des Verfassers stehen gesammelt in Abschnitt 8.

## 1. Zweck

Heute legt die Build-Variable `NEXT_PUBLIC_UI_LANG` die Sprache fest (`de` oder `en`). Ein Wechsel braucht ein neues Image. Wer YASP in einer anderen Sprache betreiben will, muss den Quelltext ändern und bauen.

Ziel: Der Betreiber wählt die Sprache im Admin. Wer eine neue Sprache anbieten will, legt eine **Sprachdatei** in ein Verzeichnis und startet den Container neu. Die Sprache erscheint danach in der Auswahl. Kein Build, keine Änderung am Quelltext.

Hintergrund: Der Fork läuft für Kunden in Deutschland, der Upstream liefert nur Englisch. Die Sprachdateien sollen so gebaut sein, dass der Upstream sie übernehmen kann (Issue #61).

## 2. Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**
- Eine einzige Spracheinstellung des Betreibers gilt für Statusseite, Admin, E-Mails, SMS und Feeds (entschieden).
- Eine neue Sprache entsteht durch eine neue Datei. Dazu ist weder ein Build noch eine Änderung am Quelltext nötig (entschieden). Ein Neustart des Containers ist zulässig (entschieden).
- Datum und Uhrzeit folgen der gewählten Sprache in der dafür üblichen Schreibweise (entschieden, vorläufig).
- Fehlt in einer Sprachdatei ein Text, erscheint der englische Text. Eine halb übersetzte Datei ist sofort nutzbar.
- Alle Sprachen, auch Deutsch und Englisch, kommen auf demselben Weg: als Dateien aus **einem** Verzeichnis (entschieden). Es gibt keine Sonderbehandlung für eine Sprache.
- Fehlt das Verzeichnis oder enthält es keine gültige Sprachdatei, legt eine Konfigurationsvariable fest, ob die Oberfläche Deutsch oder Englisch spricht (entschieden). Dafür liegen Deutsch und Englisch als Notfall-Rückfall im Image.

**Nicht-Ziele**
- Umschalten durch Besucher der Statusseite (entschieden: der Betreiber legt fest).
- Wahl der Sprache je Benutzer im Admin (entschieden: eine Sprache für alles).
- Trennung von Sprache und Datumsformat. Kommt später (entschieden).
- Übersetzen von Inhalten aus der Datenbank (Titel und Texte von Meldungen, Wartungen, Dienstgruppen). Sie bleiben, wie der Betreiber sie schreibt.
- Neue Sprachen ohne Neustart (entschieden).
- Sprachen, die das Payload-Paket nicht kennt (Abschnitt 4.1). Rechts-nach-links-Schrift, Mehrzahlformen und Übersetzungsverwaltung im Admin.

**Anti-Ziele (wäre ein Fehlschlag, auch wenn es technisch läuft)**
- Eine neue Sprache erfordert doch eine Datenbankmigration oder eine Quelltextänderung.
- Eine fehlerhafte Sprachdatei (kein gültiges JSON, falscher Name) verhindert den Start des Servers.
- Der Admin zeigt eine andere Sprache als die Statusseite.
- Der Fork entfernt sich durch die Umstellung so weit vom Upstream, dass die Abstimmung (Issue #61) unrealistisch wird. Die Funktionen `t()`, `tf()` und `ta()` bleiben deshalb erhalten. Geändert werden nur Stellen, an denen es zwingend ist (Abschnitte 4.2 und 4.5).

## 3. Ausgangslage im Quelltext (Stand 14.11.2026)

| Teil | Wo | Stand |
|---|---|---|
| Texte Statusseite, E-Mail, SMS | `src/lib/i18n/de.ts`, `en.ts` (je rund 235 Schlüssel), `t()` und `tf()` | in 43 Dateien aufgerufen, davon 17 Client-Komponenten. Auch Module ohne React rufen sie auf (`datetime.ts`, `lagebild.ts`, `status-boxes.ts`, `email.ts`, Aufgabe für Benachrichtigungen, Feeds) |
| Texte Admin | `src/lib/i18n/admin.ts` (243 Einträge), `ta(en, de?)` | englischer Originaltext ist der Schlüssel; 684 Aufrufe in 50 Dateien, meist auf Modulebene (Beschriftungen von Collections und Globals). **338 Aufrufe übergeben den deutschen Text als zweites Argument**, 266 verschiedene Texte stehen nur dort und nicht im Wörterbuch |
| Sprachwahl | `src/lib/i18n/index.ts` | `NEXT_PUBLIC_UI_LANG` wird beim Laden des Moduls gelesen |
| Sprachen des Admins | `payload.config.ts`, `i18n.supportedLanguages` | genau eine Sprache, gewählt beim Start |
| Datum, Uhrzeit | `Settings.locale` (Text, BCP 47, Standard `en-US`), `src/lib/datetime.ts` | steuert nur Datum und Uhrzeit |

## 4. Entwurf

### 4.1 Grundlage: Was Payload mitbringt

Das Payload-Paket (`@payloadcms/translations`, Version 3.90.2) enthält die Texte seiner eigenen Bedienelemente (Speichern, Löschen, Filter, Anmeldung) in rund 44 Sprachen, darunter Französisch, Spanisch, Italienisch, Polnisch und Türkisch. Diese Texte müssen wir nicht übersetzen. Im Admin sind nur Sprachen wählbar, die dieses Paket kennt. Der Dateiname einer Sprachdatei ist deshalb der Payload-Sprachcode (`fr.json`, `es.json`).

### 4.2 Sprachdatei

Eine Datei je Sprache, Name = Sprachcode, Format JSON, Zeichensatz UTF-8:

```json
{
  "meta": {
    "name": "Français",
    "dateLocale": "fr-FR"
  },
  "site": {
    "footer.timezone": "Fuseau horaire : {timezone}"
  },
  "admin": {
    "Affected Services": "Services concernés"
  }
}
```

- `meta.name`: Anzeigename in der Auswahlliste, in der Sprache selbst.
- `meta.dateLocale`: optional. Fehlt der Eintrag, leitet das System ihn aus dem Sprachcode ab (`de` → `de-DE`, `fr` → `fr-FR`, `es` → `es-ES`, `en` → `en-US`).
- `site`: Texte der Statusseite, der E-Mails, der SMS-Vorlagen und der Feeds. Schlüssel wie heute in `de.ts`.
- `admin`: Texte des Admins. Schlüssel ist der englische Originaltext, wie heute in `admin.ts`.

Die heutigen Wörterbücher `de.ts`, `en.ts` und `admin.ts` werden in `de.json` und `en.json` überführt. Dazu gehören auch die 266 deutschen Texte, die heute nur als zweites Argument von `ta()` im Quelltext stehen. Ein Skript (einmalig) zieht sie aus den 338 Aufrufen in `de.json` und entfernt das zweite Argument. Die Änderung ist mechanisch, berührt aber 338 Stellen und gehört in einen eigenen Pull Request.

**Kollisionen:** Drei englische Texte haben heute zwei deutsche Fassungen. Ein Schlüssel „englischer Text“ lässt je Sprache nur eine zu.

| Englischer Text | Fassung 1 | Fassung 2 |
|---|---|---|
| `Incidents` | Störungen | Vorfälle |
| `Admin` | Administration | Administrator |
| `Media` | Medien | Medium |

Lösung (Eigene Festlegung): Der zweite Fall bekommt einen Zusatz im Schlüssel, zum Beispiel `Admin|role` und `Media|single`. Die Aufrufstelle nennt ihn als zweites Argument (`ta('Admin', 'role')`). Ohne Zusatz gilt der Text selbst als Schlüssel. Nur diese Stellen ändern sich. Fehlt ein Schlüssel mit Zusatz in einer Sprachdatei, gilt der Text vor dem `|`. `en.json` enthält die Schlüssel der Statusseite und damit die Referenz für das Prüfwerkzeug (4.7). Im Admin ist der englische Originaltext der Schlüssel und der Rückfall.

### 4.3 Verzeichnisse und Laden

- **Ein Verzeichnis für alle Sprachen**, Pfad aus der Umgebungsvariable `LOCALES_DIR`. Der Betreiber bindet es als Volume ein. Deutsch, Englisch und jede weitere Sprache liegen dort als gleichwertige Dateien (`de.json`, `en.json`, `fr.json`). Der Server liest das Verzeichnis **beim Start** einmal ein.
- **Quelle der Dateien im Repository:** Der Ordner `locales/` im Repository enthält `de.json` und `en.json`. Er ist zugleich die Vorlage, aus der der Betreiber das Verzeichnis füllt (kopieren), und die Grundlage für eigene Übersetzungen.
- **Eingebaute Fassungen als unterste Schicht (Eigene Festlegung):** Das Image enthält Deutsch und Englisch vollständig. Sie sind keine zusätzlichen wählbaren Sprachen, sondern füllen **je Schlüssel** Lücken. Ein Text wird in dieser Reihenfolge gesucht: Datei der gewählten Sprache im Verzeichnis, eingebaute Fassung derselben Sprache (nur Deutsch und Englisch), eingebautes Englisch. So zeigt eine deutsche Installation nach einem Image-Update mit neuen Texten sofort den eingebauten deutschen Text, auch wenn die Kopie im Verzeichnis veraltet ist. Eine Datei im Verzeichnis gewinnt immer. Die Auswahl im Admin zeigt nur Sprachen, die als Datei im Verzeichnis liegen (Ausnahme: der Notfall unten).
- **Notfall-Rückfall:** Fehlt das Verzeichnis, ist es leer oder enthält es keine gültige Datei, nutzt der Server die im Image eingebauten Fassungen von Deutsch und Englisch. Welche der beiden gilt, legt die Variable `DEFAULT_LANGUAGE` fest (`de` oder `en`, Standard `de`). In diesem Fall gibt es nur diese eine Sprache, die Auswahl im Admin zeigt sie allein, und das Log nennt den Grund.
- Datei ungültig (kein JSON, Name kein bekannter Payload-Sprachcode, `meta.name` fehlt): Sprache auslassen, Grund ins Log schreiben, normal starten.
- Dateinamen und Werte sind reiner Text. Der Dateiname wird gegen die Liste der Payload-Sprachen geprüft, bevor er benutzt wird. Werte werden nirgends als HTML ausgegeben.

### 4.4 Auswahl im Admin

Neues Feld „Sprache“ in den Website-Einstellungen (`Settings`). Der Betreiber sieht eine **Auswahlliste** mit allen geladenen Sprachen, angezeigt mit `meta.name` („Deutsch“, „English“, „Français“). Ist noch nichts gewählt, gilt `DEFAULT_LANGUAGE`.

Technischer Hintergrund: Die übliche Auswahlliste von Payload (`select`) legt die Liste der Werte fest in der Datenbank an (als PostgreSQL-Enum). Käme eine Sprache hinzu, bräuchte es eine Migration. Das widerspricht dem Ziel „Datei ablegen, Neustart“. Deshalb speichert die Datenbank nur den Sprachcode als Text (`fr`). Die Auswahlliste im Admin baut eine kleine eigene Feld-Komponente aus den beim Start geladenen Sprachen, und eine Prüfung (`validate`) lehnt Werte ab, die keine geladene Sprache sind. Für den Betreiber ist das eine normale Auswahlliste. Der Umsetzer prüft, ob Payload eine Auswahlliste ohne Enum direkt erlaubt (Abschnitt 7).

Das Feld `locale` bleibt in der Datenbank, wird aber nicht mehr ausgewertet und im Admin ausgeblendet (Eigene Festlegung, Abschnitt 8). Datum und Uhrzeit nutzen `meta.dateLocale` der gewählten Sprache.

### 4.5 Texte pro Anfrage auflösen

**Statusseite, E-Mail, SMS, Feeds (`t()`, `tf()`):** Die Sprache wird pro Anfrage aus der Einstellung gelesen. Einen Zwischenspeicher für Einstellungen gibt es nicht: `getSettings()` nutzt nur `cache()` von React innerhalb einer Anfrage, und die Seiten sind `force-dynamic`. Für die Statusseite ist kein neuer Zwischenspeicher nötig.

Wie `t()` an die Sprache kommt, hängt vom Ort ab:
- **Server-Komponenten** lesen die Sprache aus den Einstellungen und rufen `t()`.
- **Client-Komponenten** erhalten das Wörterbuch (rund 235 Einträge) über einen Kontext, den das Wurzel-Layout füllt.
- **Module ohne React**, die auch von Client-Komponenten importiert werden (`datetime.ts`, `lagebild.ts`, `status-boxes.ts`): Dort gibt es keinen Hook. Die Funktionen bekommen die Sprache oder das Wörterbuch als Parameter. Signaturen und Aufrufstellen ändern sich.
- **E-Mail, SMS, Feeds** (`email.ts`, Aufgabe für Benachrichtigungen, Feed-Routen): Es gibt keinen React-Vorgang. Sie lesen die Sprache beim Versand aus den Einstellungen und übergeben sie an `t()`.

`t()` und `tf()` bekommen dafür einen optionalen Parameter für die Sprache. Ohne Parameter lesen sie die Sprache der laufenden Anfrage.

**Admin (`ta()`):** Die Beschriftungen von Collections und Globals werden beim Start ausgewertet. Sie tragen künftig die Texte **aller** geladenen Sprachen, Payload wählt zur Anfragezeit die passende (Payload erlaubt dafür Objekte der Form `{ de: '…', fr: '…' }` bei Beschriftungen, Beschreibungen und Optionen). `ta('Affected Services')` liefert dann ein solches Objekt statt einer Zeichenkette. Wo die Aufrufstelle eine Zeichenkette verlangt (Client-Komponenten, Platzhaltertexte), liefert eine zweite Funktion die Zeichenkette für die Sprache der Anfrage.

Der Umsetzer entscheidet, ob `ta()` für beide Fälle dieselbe Funktion bleibt (zwei Rückgabetypen) oder in zwei Funktionen zerfällt. Kriterium: Die 669 Aufrufstellen sollen möglichst unverändert bleiben.

### 4.6 Admin folgt der Spracheinstellung

Problem: Die Sprache der Admin-Oberfläche (Menüs, Schaltflächen, Beschriftungen) bestimmt Payload selbst. Es nimmt die Sprache, die der Browser des Benutzers meldet (oder ein Cookie `payload-lng`), und kennt unsere Einstellung „Sprache“ aus der Datenbank nicht. Ohne weiteren Schritt könnte der Admin Englisch zeigen, weil der Browser Englisch meldet, während die Statusseite Deutsch zeigt. Das widerspricht der Entscheidung „eine Sprache für alles“.

Lösung: Damit der Admin der Spracheinstellung folgt, setzt eine kleine Weiche (`proxy.ts` in Next.js 16, Dokumentation unter `node_modules/next/dist/docs/` lesen, siehe `AGENTS.md`) bei jeder Anfrage an `/admin` und `/api` das Cookie `payload-lng` auf die Spracheinstellung (`/api` damit auch Fehlertexte der Schnittstelle der Einstellung folgen, Eigene Festlegung). Die Sprachwahl im Konto eines Benutzers wird damit wirkungslos. Payload bietet keinen Schalter, sie auszublenden: Die Auswahl ist fest in der Konto-Ansicht verbaut. Möglich sind ein Ausblenden per CSS (`.payload-settings__language`) oder eine eigene Konto-Ansicht.

Die Weiche braucht die aktuelle Einstellung ohne eigene Datenbankabfrage je Anfrage. Eine Änderung der Einstellung muss innerhalb von 60 Sekunden überall gelten, auch bei mehreren Instanzen (das Helm-Chart unter `charts/` erlaubt mehrere). Die Lösung ist offen (Abschnitt 7).

### 4.7 Prüfwerkzeug

Ein Skript `scripts/check-locales` (Node) vergleicht jede Sprachdatei mit `en.json`:
- fehlende Schlüssel (Warnung),
- überzählige Schlüssel (Warnung),
- fehlende oder abweichende Platzhalter wie `{timezone}` oder `{{siteName}}` (Fehler),
- gültiges JSON und gültiger Dateiname (Fehler).

Das Skript läuft in der CI für die mitgelieferten Dateien und steht für eigene Dateien im Handbuch.

## 5. Ansätze

| | A: eigene Schicht ausbauen | B: Bibliothek (`next-intl`) | C: ein Image je Sprache |
|---|---|---|---|
| Prinzip | `t()`, `tf()`, `ta()` bleiben. Die Sprache kommt pro Anfrage aus der Einstellung. Texte in JSON-Dateien. | Wie A, Auflösung und Platzhalter von der Bibliothek. | Wie heute, ein Build je Sprache. |
| Aufwand | mittel | hoch: 44 Dateien mit `t()`/`tf()` ziehen um | gering |
| Neue Sprache | Datei ablegen, Neustart | Datei ablegen, Neustart | neues Image |
| Abstand zum Upstream | klein | größer (neue Abhängigkeit, neue Aufrufe) | keiner |
| Risiko | Kontext für Client-Komponenten selbst bauen | zusätzlicher Baustein | verfehlt das Ziel |

**Gewählt: A** (entschieden). B lohnt sich erst bei vielen Sprachen oder Mehrzahlformen, beides ist nicht absehbar. C ist ausgeschlossen, weil die Sprache beim Build festbleibt.

## 6. Ergebnis des Vorversuchs (14.11.2026)

Wegwerf-Versuch in einer Kopie, nichts davon ist im Repository:
- Produktions-Build (`output: standalone`) mit einer Konfiguration, die `*.json` aus einem Verzeichnis liest und daraus `i18n.supportedLanguages` baut (aus `@payloadcms/translations/all`).
- Verzeichnis beim Build leer. Anfrage mit Cookie `payload-lng=fr`: Englisch.
- `fr.json` abgelegt, **nur den Server neu gestartet**: derselbe Aufruf zeigt „Créer le premier utilisateur“. Die Datei wird beim Start gelesen, ein neuer Build ist nicht nötig.

**Nicht geprüft:** Beschriftungen als `{ sprache: text }`-Objekte, Weiche für das Cookie, Textfeld statt Enum, Verhalten mit mehreren Instanzen. Das sind die Punkte in Abschnitt 7.

## 7. Offene Punkte für den Umsetzer

Vor dem ersten Ausliefern jeweils kurz prüfen. Alle haben eine Rückfalllösung.

1. **Feld ohne Enum:** Ob Payload für `language` ein Feld ohne Datenbank-Enum mit eigener Auswahl-Komponente zulässt. Rückfall: Textfeld mit Hinweistext und Validierung.
2. **Weiche für das Cookie:** Woher sie die Spracheinstellung bekommt (prozessinterner Zwischenspeicher mit kurzer Lebensdauer, interner Abruf, oder das Cookie wird beim Speichern der Einstellung gesetzt). Anforderung: Änderung gilt innerhalb von 60 Sekunden, auch mit mehreren Instanzen. Rückfall: Änderung gilt nach Neustart.
3. **Beschriftungen als Objekte:** Ob alle Stellen, an denen `ta()` heute steht (Beschriftungen, Beschreibungen, Optionen, Platzhalter, Tabs, Schaltflächen in eigenen Komponenten), Objekte der Form `{ sprache: text }` akzeptieren. Wo nicht, die Zeichenkette über die Sprache der Anfrage holen.
4. **Zusätzliche Payload-Texte:** Ob Collections mit eigenen Fehlermeldungen (`validate`) übersetzbar sein müssen.
5. **Tests:** `docker-compose.test.yml` setzt heute `NEXT_PUBLIC_UI_LANG=en`. Künftig braucht die Testumgebung den Anfangswert der Einstellung (Abschnitt 8, Punkt 3). Tests laufen in beiden Sprachen, mindestens Statusseite und Admin-Anmeldung.

## 8. Eigene Festlegungen des Verfassers

Diese Punkte hat Frank nicht entschieden. Sie sind Vorschläge und bei Widerspruch zu ändern.

1. **Ordner `locales/` im Repository als Vorlage**, aus dem der Betreiber das Verzeichnis füllt. Das Image enthält zusätzlich nur einen eingebauten Notfall-Rückfall für Deutsch und Englisch.
2. **Feld `locale` bleibt in der Datenbank und wird im Admin ausgeblendet.** Grund: keine Migration, kein Verlust bei Rücknahme. Der Datumsausdruck folgt dem Sprachcode.
3. **Die Build-Variable `NEXT_PUBLIC_UI_LANG` entfällt.** Ersatz: Umgebungsvariable `DEFAULT_LANGUAGE` (Laufzeit, `de` oder `en`). Sie wählt den Notfall-Rückfall und ist der Anfangswert der Einstellung, solange der Betreiber keinen Wert gewählt hat. Standard `de`. Grund: Test- und Demo-Umgebungen brauchen einen Anfangswert ohne Datenbankzugriff.
4. **Rückfall immer Englisch**, auch für die Statusseite.
5. **Sprachdateien enthalten die Standardtexte der SMS- und E-Mail-Vorlagen**, aber nicht die bereits vom Betreiber gespeicherten Texte.
6. **Die Weiche überschreibt die Sprachwahl im Konto** (Abschnitt 4.6), statt sie zusätzlich zuzulassen.
7. **Eingebaute Fassungen als unterste Schicht je Schlüssel** (Abschnitt 4.3, von Frank Albrecht bestätigt am 14.11.2026), damit ein Image-Update keine englischen Einzeltexte in deutsche Installationen bringt.
8. **Schlüssel mit Zusatz** für die drei Kollisionen (Abschnitt 4.2).
9. **Bestehende Installationen:** Keine Übernahme der Altwerte. Das Änderungsprotokoll weist darauf hin, dass der Anfangswert der Sprache `DEFAULT_LANGUAGE` (Standard `de`) ist, dass eine englisch gebaute Installation `DEFAULT_LANGUAGE=en` setzen muss und dass das Feld `locale` nicht mehr gilt.
10. **SMS-Vorlagen:** Die vier Standardtexte (heute englische `defaultValue` in `src/globals/SmsSettings.ts`) kommen aus der Sprachdatei der Sprache, die beim ersten Speichern aktiv ist. Danach sind sie gespeicherte Betreibertexte und folgen einem Sprachwechsel nicht.
11. **Erste Sprachdatei außer Deutsch und Englisch ist keine Aufgabe dieses Issues.** Zur Abnahme genügt eine Testdatei mit wenigen Einträgen.

## 9. Reihenfolge der Umsetzung

Jeder Schritt ist ein eigenes Issue und ein eigener Pull Request, in dieser Reihenfolge:

1. **Texte nach JSON:** `de.ts`, `en.ts` und `admin.ts` nach `locales/de.json` und `en.json` überführen, einschließlich der 266 deutschen Texte aus den Aufrufen von `ta()` (Skript, 338 Stellen, Kollisionen mit Zusatz). Verhalten unverändert, `NEXT_PUBLIC_UI_LANG` bleibt vorerst.
2. **Laden und Kontext:** Laden der Dateien beim Start, eingebaute Fassungen, Kontext für Client-Komponenten, Parameter für Module ohne React, `DEFAULT_LANGUAGE` statt `NEXT_PUBLIC_UI_LANG`, `check-locales`.
3. **Einstellung „Sprache“:** Feld, Auswahlliste, Statusseite, E-Mail, SMS, Feeds, Datum.
4. **Admin:** Beschriftungen mehrsprachig (`ta()`), Weiche für das Cookie, Konto-Sprachwahl ausblenden.
5. **Dokumentation:** Handbuch „Eigene Sprache hinzufügen“, `docs/src/getting-started/configuration.md`, Hinweis im Änderungsprotokoll.
6. **Abstimmung mit dem Upstream** (Issue #61): Die Struktur als Vorschlag vorlegen.

## 10. Abnahme

- `fr.json` mit drei übersetzten Einträgen in das Sprachverzeichnis legen, Container neu starten: „Français“ erscheint in der Auswahl.
- Einstellung auf Französisch: Statusseite, Admin-Anmeldung und eine Test-E-Mail erscheinen auf Französisch, nicht übersetzte Einträge auf Englisch.
- Fehlerhafte Datei (`kaputt.json` mit ungültigem JSON): Server startet, Log nennt die Datei, Sprache fehlt in der Auswahl.
- Verzeichnis nicht eingebunden, `DEFAULT_LANGUAGE=en`: Oberfläche auf Englisch, Auswahl zeigt nur English, Log nennt den Grund.
- Datum und Uhrzeit auf der Statusseite folgen der Sprache (`de`: 14.11.2026, 24 Stunden).
- Wechsel der Einstellung wirkt auf Statusseite und Admin ohne Neustart.
- `scripts/check-locales` meldet für eine Datei mit fehlendem Platzhalter einen Fehler.
