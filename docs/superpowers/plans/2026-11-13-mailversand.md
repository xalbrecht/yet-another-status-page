# Mailversand des Verfügbarkeitsberichts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auf der Berichtsseite versendet die Schaltfläche „Per Mail senden“ den Export (PDF, Excel, Bilder) an Empfänger, die in den E-Mail-Einstellungen im Admin stehen.

**Architecture:** Eine neue Funktion `sendReportMail` ruft `exportFiles` auf, packt PDF und Excel in die erste Mail und die Bilder in ZIP-Teile unter einer festen Größengrenze, jeder Teil eine eigene Mail. Der Versand geht über das vorhandene `sendEmail` (nodemailer, SMTP-Einstellungen aus dem Admin). Eine POST-Route löst ihn aus, eine Client-Schaltfläche zeigt vorher die Empfänger.

**Tech Stack:** nodemailer (vorhanden), `fflate` (vorhanden), Payload Global `email-settings`, `node:test` mit `tsx`, Playwright (Route).

**Spec:** `docs/superpowers/specs/2026-11-12-berichtsexport-design.md` (Abschnitte 2 und 6, Schnittstelle für den Mailversand), Issue #65 im Fork (GitHub). Setzt PR #70 im Fork (Export, `exportFiles`, `loadReportContext`) voraus.

## Global Constraints

- Branch `feature/65-mailversand` von `main`, nie direkt auf `main`. Commit `<typ>(<scope>): <Imperativ> (#65)`, erste Zeile höchstens 50 Zeichen, Anhang `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Beschriftungen über `ta('English', 'Deutsch')` aus `@/lib/i18n/admin`.
- Zugriff nur für angemeldete Nutzer (Status 401), im Testmodus offen wie die übrigen Routen (`isTestMode()`). Versand nur per POST.
- Empfänger kommen **nur** aus den Einstellungen, nie aus der Anfrage. Die Anfrage trägt nur Zeitraum, Rechenart und Wartungsart (`period`, `from`, `to`, `calc`, `maintenance`).
- Größengrenze je Mail: **6 000 000 Byte** Anhang (`MAIL_PART_LIMIT_BYTES`). Grund: Postfix (`boky/postfix`) nimmt standardmäßig 10 240 000 Byte je Mail an, Base64 macht aus 6 MB rund 8,2 MB. Ist PDF plus Excel größer, wird nichts gesendet und die Antwort sagt es (Status 413).
- Es läuft höchstens ein Versand gleichzeitig im Prozess (Speicher: Test hat 768 MiB). Ein zweiter Aufruf bekommt Status 409.
- Neue Abhängigkeit: keine. Keine Änderung am Export selbst.
- Prüfen mit `npm run test:unit`, `npx tsc --noEmit`, `npm run lint`. E2E nach `docs/src/development/testing.md`, Umgebung von Hand starten, wenn `scripts/run-e2e-tests.sh` nach 2,5 Minuten abbricht.

## Review Focus

- Leere oder ungültige Empfängerliste (`a@b,`, `a@b c@d`, Semikolon, Zeilenumbruch, Großbuchstaben, doppelte Adressen): nichts wird gesendet, die Einstellung speichert ungültige Werte nicht (Task 1, 4).
- SMTP nicht eingerichtet oder Server nicht erreichbar: klare Fehlermeldung, kein Absturz, kein halber Versand ohne Hinweis (Task 3, 4).
- Ein Teil der Mails geht durch, ein späterer scheitert: die Antwort nennt, wie viele Mails raus sind, und die Schaltfläche bietet keinen stillen Neuversand an (Task 3, 5).
- Doppelklick und zwei Administratoren gleichzeitig: nur ein Versand, der andere bekommt 409 (Task 4).
- Bericht ohne Dienste oder ohne Gruppen: Mail mit PDF und Excel geht trotzdem raus (Task 3).
- Dateien über der Grenze: PDF oder Excel allein über 6 MB ergibt 413 vor dem ersten Versand, ein einzelnes Bild über der Grenze bekommt eine eigene Mail (Task 3).

## Dateien

| Datei | Aufgabe |
|---|---|
| `src/globals/EmailSettings.ts`, `src/migrations/20261113_100000_add_report_recipients.ts`, `src/migrations/index.ts`, `src/payload-types.ts` | Empfängerfeld |
| `src/lib/report/export/recipients.ts` (neu) | Empfängerliste lesen und prüfen |
| `src/lib/email.ts` | Anhänge, `EmailResult` exportiert |
| `src/lib/report/export/mail.ts` (neu) | Aufteilung in Mails, `sendReportMail` |
| `src/app/api/availability-report/send/route.ts` (neu) | POST-Route mit Sperre |
| `src/components/admin/availability-report/SendReportButton.tsx` (neu), `index.tsx`, `report.scss` | Schaltfläche |
| `tests/unit/report-recipients.test.ts`, `report-mail.test.ts`, `report-send-button.test.tsx`, `tests/e2e/availability-report-send.spec.ts` | Tests |

---

### Task 1: Empfängerfeld in den E-Mail-Einstellungen

**Files:**
- Create: `src/lib/report/export/recipients.ts`, `src/migrations/20261113_100000_add_report_recipients.ts`, `tests/unit/report-recipients.test.ts`
- Modify: `src/globals/EmailSettings.ts`, `src/migrations/index.ts`, `src/payload-types.ts`

**Interfaces:**
- Produces:
  - `parseRecipients(text: string | null | undefined): string[]`: trennt an Komma, Semikolon und Zeilenumbruch, entfernt Leerraum, wandelt in Kleinbuchstaben, entfernt Duplikate (Reihenfolge der ersten Nennung), lässt leere Einträge weg. Prüft nicht.
  - `validateRecipients(text: string | null | undefined): true | string`: `true` bei leerem Text oder lauter gültigen Adressen (einfache Prüfung `^[^\s@]+@[^\s@]+\.[^\s@]+$`), sonst eine Meldung, die den ersten ungültigen Eintrag nennt (`ta`).
  - Feld `reportRecipients` (`type: 'textarea'`, `validate` ruft `validateRecipients`) in der Gruppe der Absender- und Empfängerfelder von `EmailSettings`, Beschriftung `Empfänger des Verfügbarkeitsberichts`, Beschreibung „Eine Adresse je Zeile oder durch Komma getrennt. Leer: kein Versand“.
  - Migration: `ALTER TABLE "email_settings" ADD COLUMN "report_recipients" varchar;`, `down` entfernt die Spalte.

- [ ] **Step 1: Failing tests** in `tests/unit/report-recipients.test.ts`: `parseRecipients('A@x.de, b@x.de;\nc@x.de')` ergibt `['a@x.de','b@x.de','c@x.de']`; `parseRecipients('a@x.de,a@x.de, A@X.de')` ergibt `['a@x.de']`; `parseRecipients('')`, `parseRecipients(null)`, `parseRecipients(' ,; ')` ergeben `[]`; `validateRecipients('a@x.de, b@x.de')` ist `true`; `validateRecipients('')` ist `true`; `validateRecipients('a@x.de b@x.de')` ist ein String, der `a@x.de b@x.de` enthält; `validateRecipients('a@x.de, kein-at')` ist ein String, der `kein-at` enthält.
- [ ] **Step 2:** `npx tsx --test tests/unit/report-recipients.test.ts` — erwartet FAIL.
- [ ] **Step 3:** `recipients.ts`, Feld, Migration anlegen, Migration in `index.ts` eintragen (Schema der vorhandenen Einträge). `npm run generate:types` ausführen, damit `reportRecipients` in `payload-types.ts` steht; falls das ohne Datenbank nicht läuft, das Feld in `EmailSetting` und `EmailSettingsSelect` von Hand ergänzen (`reportRecipients?: string | null`, `reportRecipients?: T`).
- [ ] **Step 4:** `npm run test:unit`, `npx tsc --noEmit`, `npm run lint` — erwartet PASS.
- [ ] **Step 5:** `git add src tests` und `git commit -m "feat(bericht): Füge Empfänger des Berichts hinzu (#65)"`.

### Task 2: E-Mail mit Anhängen

**Files:**
- Modify: `src/lib/email.ts`
- Create: `tests/unit/email-attachments.test.ts`

**Interfaces:**
- Produces:
  - `EmailOptions` bekommt `to: string | string[]` und `attachments?: Array<{ filename: string; content: Uint8Array; contentType?: string }>`. `EmailResult` wird exportiert.
  - `buildMailMessage(emailSettings: EmailSetting, options: EmailOptions): nodemailer.SendMailOptions`: reine Funktion, baut `from`, `to` (Liste wird zu einer Zeichenkette mit Komma), `replyTo`, Betreff, Text, HTML, Kopfzeilen und die Anhänge (`content` als `Buffer`). `sendEmail` ruft sie auf, Verhalten ohne Anhänge bleibt gleich.

- [ ] **Step 1: Failing tests** in `tests/unit/email-attachments.test.ts`: `buildMailMessage` mit `to: ['a@x.de','b@x.de']` ergibt `to === 'a@x.de, b@x.de'`; mit einem Anhang `{ filename: 'a.pdf', content: new Uint8Array([1,2,3]) }` enthält `attachments[0].filename === 'a.pdf'` und `Buffer.isBuffer(attachments[0].content)`; ohne `attachments` ist das Feld `undefined`; `from` enthält Absendername und Adresse aus den Einstellungen; `replyTo` fällt auf die Absenderadresse zurück. Zusätzlich über `nodemailer.createTransport({ jsonTransport: true }).sendMail(buildMailMessage(...))`: die Nachricht enthält den Anhang unter seinem Dateinamen (`JSON.parse(info.message).attachments[0].filename`).
- [ ] **Step 2:** Test — erwartet FAIL (`buildMailMessage` fehlt).
- [ ] **Step 3:** `buildMailMessage` herauslösen, `sendEmail` darauf umstellen. Bestehende Aufrufer (`sendBulkEmails`, Abonnentenmails) ändern sich nicht.
- [ ] **Step 4:** `npm run test:unit`, `npx tsc --noEmit` — erwartet PASS, alle bisherigen E-Mail-Tests bleiben grün.
- [ ] **Step 5:** `git add src tests` und `git commit -m "feat(email): Unterstütze Anhänge und mehrere Empfänger (#65)"`.

### Task 3: Berichtsmails zusammenstellen und senden

**Files:**
- Create: `src/lib/report/export/mail.ts`, `tests/unit/report-mail.test.ts`

**Interfaces:**
- Consumes: `exportFiles`, `ExportFile` (`./files`), `ReportContext` (`@/lib/report/load`), `EmailOptions`, `EmailResult` (`@/lib/email`), `zipSync` aus `fflate`.
- Produces:
  - `MAIL_PART_LIMIT_BYTES = 6_000_000`.
  - `type MailPlan = { attachments: Array<{ filename: string; content: Uint8Array; contentType?: string }>; note: string }[]`
  - `planReportMails(files: ExportFile[], limit?: number): MailPlan`: Mail 1 enthält die Datei mit Endung `.pdf` und die mit Endung `.xlsx` (unverändert als Anhang). Alle übrigen Dateien (PNG) kommen in der Reihenfolge ihres Pfades in ZIP-Teile (`fflate.zipSync`, Stufe 0, Pfade wie im Export), ein Teil wird geschlossen, bevor er `limit` überschreiten würde. Jeder Teil ist eine eigene Mail mit dem Anhang `bilder-teil-<i>-von-<n>.zip`. Eine einzelne Datei über `limit` bekommt einen eigenen Teil. Sind PDF plus Excel größer als `limit`, wirft die Funktion `ReportMailTooLargeError` mit der Größe in MB und dem Dateinamen.
  - `class ReportMailTooLargeError extends Error`.
  - `sendReportMail(input: { context: ReportContext; recipients: string[]; send: (options: EmailOptions) => Promise<EmailResult> }): Promise<{ mails: number; sent: number; failed: number; errors: string[] }>`: sammelt die Dateien aus `exportFiles(context)` in ein Feld, plant, sendet die Mails **nacheinander** (nie parallel), Betreff `Verfügbarkeitsbericht <context.period.label>` plus ` (Teil i von n)` bei mehr als einer Mail, Text nennt Zeitraum, Zahl der Dienste und bei Teilen den Hinweis „Die Bilder folgen in weiteren Mails“. Bricht ab dem ersten Fehler ab und meldet `sent`, `failed: 1`, `errors`. Wirft vor dem ersten Versand, wenn `recipients` leer ist (`Error`) oder `planReportMails` wirft.

- [ ] **Step 1: Failing tests** in `tests/unit/report-mail.test.ts`:
  - `planReportMails` mit PDF (1 000 Byte), Excel (2 000 Byte) und drei PNG zu je 2 000 Byte, Grenze 10 000: eine Mail mit zwei Anhängen (`.pdf`, `.xlsx`) und eine zweite mit `bilder-teil-1-von-1.zip`. Der Name der ersten Mail trägt keine Teilnummer.
  - Mit zehn PNG zu je 2 000 Byte und Grenze 5 000 entstehen fünf Bildteile mit je zwei Dateien (Auszählung mit `unzipSync`, drei Dateien wären 6 000 Byte und damit zu viel), Namen `bilder-teil-1-von-5.zip` bis `bilder-teil-5-von-5.zip`.
  - Ein einzelnes PNG über der Grenze steht allein in einem Teil.
  - PDF 4 000 Byte, Excel 4 000 Byte, Grenze 5 000: `ReportMailTooLargeError`, Meldung nennt die Größe.
  - Ohne PNG (nur PDF und Excel): genau eine Mail, keine ZIP-Teile.
  - `sendReportMail` mit Attrappe `send` (zeichnet auf) und Kontext aus `report-export-files.test.ts`-Art (`context(...)` aus der Test-Hilfe `tests/unit/export-fixtures.ts` erweitern): Mails gehen nacheinander raus (Reihenfolge der Aufrufe, `send` wartet auf das Ende des vorigen), `to` ist die Empfängerliste, Betreff des ersten Mails enthält `Oktober 2026`.
  - `send` scheitert beim zweiten Aufruf: Ergebnis `sent: 1, failed: 1`, `errors` enthält die Fehlermeldung, ein dritter Aufruf findet nicht statt.
  - Leere `recipients`: wirft vor jedem Aufruf von `send`.
- [ ] **Step 2:** Test — erwartet FAIL.
- [ ] **Step 3:** `mail.ts` umsetzen. Zeitüberschreitung: `send` bekommt keine eigene Frist, die SMTP-Frist von nodemailer gilt.
- [ ] **Step 4:** `npm run test:unit`, `npx tsc --noEmit`, `npm run lint` — erwartet PASS.
- [ ] **Step 5:** `git add src tests` und `git commit -m "feat(bericht): Stelle die Berichtsmails zusammen (#65)"`.

### Task 4: POST-Route mit Sperre

**Files:**
- Create: `src/app/api/availability-report/send/route.ts`, `tests/e2e/availability-report-send.spec.ts`

**Interfaces:**
- Consumes: `loadReportContext`, `sendReportMail`, `parseRecipients`, `sendEmail`, `isTestMode`, Anmeldeprüfung wie in `src/app/api/availability-report/route.ts`, `payload.findGlobal({ slug: 'email-settings' })` (Slug aus `EmailSettings.ts` prüfen).
- Produces: `POST /api/availability-report/send` mit den Parametern der Berichtsseite im Query-String. Antworten: 200 `{ mails, sent, recipients: string[] }`; 400 bei ungültigem Zeitraum oder leerer Empfängerliste (Meldung nennt „Empfänger in den E-Mail-Einstellungen eintragen“); 401 ohne Anmeldung; 409 `{ error }`, wenn schon ein Versand läuft (modulweites Flag, in `finally` zurückgesetzt); 413 bei `ReportMailTooLargeError`; 502 `{ error, sent, mails }`, wenn der SMTP-Versand scheitert (Meldung des Fehlers, Zahl bereits gesendeter Mails); 500 sonst. SMTP nicht eingerichtet (`smtpHost` oder `smtpFromAddress` fehlt) ergibt 400 mit `SMTP ist nicht eingerichtet`. GET ergibt 405.

- [ ] **Step 1: Failing tests** in `tests/e2e/availability-report-send.spec.ts` (E2E-Umgebung ohne eingerichtetes SMTP, Empfänger nicht gesetzt): `POST` mit `period=<Monat>` ergibt 400 und eine Meldung, die „Empfänger“ nennt; `GET` ergibt 405; `POST` mit `period=2026-13` ergibt 400; mit gesetztem Empfängerfeld (über die Payload-API in den Einstellungen gespeichert) und ohne SMTP ergibt `POST` 400 mit „SMTP“; ein Versuch, Empfänger über den Query-String zu setzen (`?to=x@y.de`), ändert nichts (Antwort wie ohne). Ein Test mit `E2E_ACCESS_LOCKED=1` prüft 401 wie in `availability-report.spec.ts`. Räumt die Einstellungen am Ende auf (Empfängerfeld leeren).
- [ ] **Step 2:** E2E nach `docs/src/development/testing.md` — erwartet FAIL (Route fehlt).
- [ ] **Step 3:** Route umsetzen. Reihenfolge der Prüfungen vor dem ersten Rendern: Anmeldung, Zeitraum, Empfänger, SMTP, Sperre.
- [ ] **Step 4:** E2E erneut, `npm run test:unit`, `npx tsc --noEmit`, `npm run lint` — erwartet PASS.
- [ ] **Step 5:** `git add src tests` und `git commit -m "feat(bericht): Versende den Bericht über eine Route (#65)"`.

### Task 5: Schaltfläche, Handbuch und Prüfung

**Files:**
- Create: `src/components/admin/availability-report/SendReportButton.tsx`, `tests/unit/report-send-button.test.tsx`
- Modify: `src/components/admin/availability-report/index.tsx`, `report.scss`, `docs/src/admin/availability-report.md`, `docs/src/admin/` (Seite der E-Mail-Einstellungen, falls vorhanden), `docs/src/development/testing.md`

**Interfaces:**
- Produces: `SendReportForm(props: { recipients: string[]; query: string; state: 'idle' | 'confirm' | 'sending' | 'done' | 'error'; message?: string; onAsk?: () => void; onCancel?: () => void; onConfirm?: () => void })`: reine Darstellung. Ohne Empfänger zeigt sie statt der Schaltfläche den Hinweis „Keine Empfänger eingetragen“ mit Link auf die E-Mail-Einstellungen. `idle`: Schaltfläche „Per Mail senden“. `confirm`: Satz „Senden an: a@x.de, b@x.de“ und die Schaltflächen „Jetzt senden“ und „Abbrechen“. `sending`: Schaltflächen gesperrt (`disabled`), Hinweis „Der Versand läuft, das kann eine Minute dauern.“. `done` und `error`: Meldung in `role="status"` bzw. `role="alert"`, bei `error` mit bereits gesendeten Mails, ohne Knopf für einen stillen Neuversand.
  - `SendReportButton(props: { recipients: string[]; query: string })` (`'use client'`): Zustandsautomat über `fetch('/api/availability-report/send?' + query, { method: 'POST' })`, wertet Status und `error` der Antwort aus.
  - `query` wird in `index.tsx` aus der Auswahl gebaut (`period`, `from`, `to`, `calc`, `maintenance`, wie `ExportButtons`). Die Empfänger liest `index.tsx` mit `parseRecipients` aus den E-Mail-Einstellungen. Die Schaltfläche steht neben `ExportButtons`.

- [ ] **Step 1: Failing tests** in `tests/unit/report-send-button.test.tsx`: `idle` mit Empfängern zeigt „Per Mail senden“; `confirm` nennt beide Adressen und zeigt „Jetzt senden“ und „Abbrechen“; `sending` hat `disabled` an allen Knöpfen; ohne Empfänger gibt es keine Schaltfläche, sondern den Hinweis und einen Link auf `/admin/globals/email-settings` (Slug aus dem Code prüfen); `error` mit `message` hat `role="alert"` und zeigt die Meldung; `done` hat `role="status"`. Eine Adresse mit `<` im Empfängertext wird maskiert (React).
- [ ] **Step 2:** Test — erwartet FAIL.
- [ ] **Step 3:** Komponenten und Einbau umsetzen. Handbuch: Abschnitt „Mailversand“ (Empfänger eintragen, was die Mails enthalten, Aufteilung in Teile, Größengrenze 6 MB, Fehlermeldungen, ein Versand zur Zeit). `testing.md` ergänzen.
- [ ] **Step 4:** `npm run test:unit`, `npx tsc --noEmit`, `npm run lint` — erwartet PASS.
- [ ] **Step 5:** `git add src tests docs` und `git commit -m "feat(bericht): Füge die Schaltfläche Per Mail senden hinzu (#65)"`, danach die Handbuchänderung getrennt: `git commit -m "docs(bericht): Beschreibe den Mailversand (#65)"`.

## Nach der Umsetzung (nicht automatisch prüfbar, für den PR-Text)

- **Auf Dev mit dem Auffangserver:** `ssh -L 8025:127.0.0.1:8025 lissrem`, dann `http://localhost:8025`: Mails kommen an, Anhänge öffnen sich (PDF, Excel, ZIP-Teile entpacken), Reihenfolge „Teil i von n“ stimmt.
- **Größe mit echten Daten:** Passt PDF plus Excel unter 6 MB? Im synthetischen Test war das PDF 13 MB. Ist es zu groß, ist das Folgearbeit (PDF-Bilder kleiner einbetten) oder die Grenze von Postfix wird im Projekt `yasp.io` angehoben (`message_size_limit`, Auftrag an die `yasp.io`-Sitzung).
- **Speicher auf Test (768 MiB):** ein Versand, `RestartCount`, `docker stats`. Der Versand hält alle Dateien (rund 40 MB) und rendert wie der Export.
- **Von Hand:** Empfängerfeld mit ungültiger Adresse speichern (abgewiesen), Schaltfläche ohne Empfänger, Doppelklick auf „Jetzt senden“.
