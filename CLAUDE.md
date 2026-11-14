@AGENTS.md

## Öffentlicher Fork

Dieser Fork ist öffentlich. In Dateien, Commits, Issues, Pull Requests und Kommentaren stehen keine internen Hostnamen, Pfade zu Zertifikaten, Mailadressen des Betreibers und keine Zugangsdaten. Platzhalter verwenden (`<test-host>`, `/path/to/corporate-ca.pem`).

Vor jedem Push und vor jedem `gh`-Befehl, der etwas veröffentlicht, läuft beim Betreiber lokal eine Prüfung auf interne Namen (`~/.claude/scripts/publish_guard.py`, Hook und `pre-push`). Bei Treffern fragt sie nach. Claude umgeht sie nie und setzt `PUBLISH_GUARD_OK` nicht.
