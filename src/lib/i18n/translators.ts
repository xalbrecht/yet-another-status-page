import deJson from '../../../locales/de.json' with { type: 'json' }
import enJson from '../../../locales/en.json' with { type: 'json' }
import { makeTranslators, type Translate, type TranslateFormat } from './core'
import { buildSiteDictionary, deriveDateLocale, resolveLanguage, type LocaleFile } from './locales'
import { i18nState } from './state'

// t, tf und Wörterbuch je Sprache. Nur auf dem Server einbinden (Dateizugriff über state.ts).
// Kein Import von Payload: Die Globals (Settings.ts) nutzen dieses Modul, ein Import der Konfiguration wäre ein Kreis.
// Client-Komponenten bekommen Texte über useTranslation(), gemeinsame Module t/tf als Parameter.

const builtin: Record<string, LocaleFile> = { de: deJson, en: enJson }

export type Translators = {
  t: Translate
  tf: TranslateFormat
  lang: string
  dateLocale: string
  dictionary: Record<string, string>
}

const cache = new Map<string, Translators>()

// t, tf und Wörterbuch einer Sprache. Die Dateien ändern sich bis zum Neustart nicht,
// deshalb baut jede Sprache ihr Wörterbuch einmal. Eine unbekannte Sprache ergibt DEFAULT_LANGUAGE.
export function translatorsFor(language: string): Translators {
  const lang = resolveLanguage(language, i18nState.available, i18nState.language)
  let entry = cache.get(lang)
  if (!entry) {
    const dictionary = buildSiteDictionary(lang, i18nState.files, builtin)
    const meta = i18nState.files[lang]?.meta ?? builtin[lang]?.meta
    entry = { ...makeTranslators(dictionary), lang, dateLocale: deriveDateLocale(lang, meta), dictionary }
    cache.set(lang, entry)
  }
  return entry
}

export function translatorsForSettings(settings: { language?: string | null } | null | undefined): Translators {
  return translatorsFor(settings?.language ?? '')
}

// Auswahl im Admin: Code und Anzeigename aller wählbaren Sprachen.
export function languageOptions(): { code: string; name: string }[] {
  return i18nState.available.map((code) => ({
    code,
    name: i18nState.files[code]?.meta.name ?? builtin[code]?.meta.name ?? code,
  }))
}
