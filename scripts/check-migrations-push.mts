/**
 * Hilfsskript zu `check-migrations.mts`: startet Payload im Entwicklungsmodus gegen die Datenbank in
 * `DATABASE_URI`. Payload legt das Schema dann selbst aus der Konfiguration an (`push`).
 */
import { getPayload } from 'payload'
import config from '../payload.config'

await getPayload({ config })
process.exit(0)
