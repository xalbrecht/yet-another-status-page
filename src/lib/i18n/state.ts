import { translations } from '@payloadcms/translations/all'
import deJson from '../../../locales/de.json' with { type: 'json' }
import enJson from '../../../locales/en.json' with { type: 'json' }
import { initI18n } from './init'

// Zustand der Sprachdateien, einmal beim Start des Servers gelesen (Variablen LOCALES_DIR, DEFAULT_LANGUAGE).
// Nur auf dem Server einbinden: Der Zugriff auf das Dateisystem lässt den Client-Build scheitern.
export const i18nState = initI18n(
  { LOCALES_DIR: process.env.LOCALES_DIR, DEFAULT_LANGUAGE: process.env.DEFAULT_LANGUAGE },
  { de: deJson, en: enJson },
  Object.keys(translations),
)

for (const problem of i18nState.problems) console.warn(`[i18n] ${problem}`)
