import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parseLocaleFile, type LocaleFile } from './locales'

// Liest alle *.json aus dem Verzeichnis. Kaputte oder unbekannte Dateien werden übersprungen
// und als Problem gemeldet, ein fehlendes Verzeichnis ist kein Fehler (es gelten die eingebauten Fassungen).
// `label` benennt das Verzeichnis in den Meldungen (Standard: die Variable LOCALES_DIR mit dem Pfad).
export function readLocaleDir(
  dir: string,
  accepted: readonly string[],
  label: string = `LOCALES_DIR "${dir}"`,
): { files: Record<string, LocaleFile>; problems: string[] } {
  const files: Record<string, LocaleFile> = {}
  const problems: string[] = []
  let names: string[]
  try {
    if (!statSync(dir).isDirectory()) return { files, problems: [`${label} ist kein Verzeichnis`] }
    names = readdirSync(dir).filter((name) => name.endsWith('.json')).sort()
  } catch (error) {
    return { files, problems: [`${label} nicht lesbar: ${(error as Error).message}`] }
  }
  for (const name of names) {
    const code = name.slice(0, -'.json'.length)
    try {
      const result = parseLocaleFile(code, JSON.parse(readFileSync(join(dir, name), 'utf8').replace(/^\uFEFF/, '')), accepted)
      if ('file' in result) files[code] = result.file
      else problems.push(result.problem)
    } catch (error) {
      problems.push(`${name}: ${(error as Error).message}`)
    }
  }
  return { files, problems }
}
