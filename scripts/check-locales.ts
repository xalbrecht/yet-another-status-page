/**
 * Dateiname:   check-locales.ts
 * Zweck:       Prüft Sprachdateien (Format: docs/superpowers/specs/2026-11-14-sprachdateien-design.md, Abschnitt 4.2)
 *              gegen die englische Referenz locales/en.json.
 * Aufruf:      npm run check:locales [Verzeichnis]   (Standard: locales)
 * Ergebnis:    Warnungen (fehlende, überzählige oder leere Werte in "site", leere Werte in "admin") und Fehler (ungültige Datei,
 *              abweichende Platzhalter). Exit-Code 1 bei Fehlern.
 */
import { pathToFileURL } from 'node:url'
import { translations } from '@payloadcms/translations/all'
import enJson from '../locales/en.json' with { type: 'json' }
import { readLocaleDir } from '../src/lib/i18n/read-locale-dir'
import type { LocaleFile } from '../src/lib/i18n/locales'

// {name} (tf) und {{name}} (Vorlagensyntax der Settings) sind verschiedene Platzhalter.
const placeholders = (text: string): string[] => (text.match(/\{\{?\w+\}?\}/g) ?? []).sort()

const sameSet = (a: string[], b: string[]): boolean => a.length === b.length && a.every((value, index) => value === b[index])

// Schlüssel im Block admin können einen Zusatz tragen: "Text|kontext". Der Zusatz gehört nicht zum Text.
const adminBaseText = (key: string): string => key.replace(/\|[a-z]+$/, '')

export function checkLocales(
  files: Record<string, LocaleFile>,
  reference: LocaleFile,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  for (const [code, file] of Object.entries(files)) {
    for (const key of Object.keys(reference.site)) {
      if (!Object.hasOwn(file.site, key)) warnings.push(`${code}: Schlüssel fehlt in site: ${key}`)
      else if (file.site[key].trim() === '') warnings.push(`${code}: Wert ist leer in site: ${key}`)
      else if (!sameSet(placeholders(file.site[key]), placeholders(reference.site[key]))) {
        errors.push(`${code}: Platzhalter in site weichen ab: ${key}`)
      }
    }
    for (const key of Object.keys(file.site)) {
      if (!Object.hasOwn(reference.site, key)) warnings.push(`${code}: Schlüssel ist überzählig in site: ${key}`)
    }
    for (const [key, value] of Object.entries(file.admin)) {
      if (value.trim() === '') warnings.push(`${code}: Wert ist leer in admin: ${key}`)
      if (!sameSet(placeholders(value), placeholders(adminBaseText(key)))) {
        errors.push(`${code}: Platzhalter in admin weichen vom Schlüssel ab: ${key}`)
      }
    }
  }
  return { errors, warnings }
}

function main(): void {
  const dir = process.argv[2] ?? 'locales'
  const { files, problems } = readLocaleDir(dir, Object.keys(translations))
  const result = checkLocales(files, enJson)
  const errors = [...problems, ...result.errors]
  for (const warning of result.warnings) console.warn(`Warnung: ${warning}`)
  for (const error of errors) console.error(`Fehler:  ${error}`)
  console.log(`${Object.keys(files).length} Datei(en) geprüft, ${result.warnings.length} Warnung(en), ${errors.length} Fehler`)
  process.exit(errors.length > 0 ? 1 : 0)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
