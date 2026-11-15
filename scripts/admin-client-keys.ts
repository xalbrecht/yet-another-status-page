/**
 * Dateiname:   admin-client-keys.ts
 * Zweck:       Ermittelt die Admin-Texte, die Client-Komponenten brauchen (Aufrufe von ta() in Dateien mit
 *              useAdminText). Nur diese Texte gehen an den Browser (getAdminDictionary), nicht das ganze Wörterbuch.
 * Aufruf:      npm run generate:admin-client-keys   (schreibt src/lib/i18n/admin-client-keys.json)
 *              Ein Test vergleicht die Datei mit dem Quelltext, ein vergessener Lauf fällt in der CI auf.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const OUTPUT = 'src/lib/i18n/admin-client-keys.json'

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

const unescapeLiteral = (text: string): string =>
  text.replace(/\\(.)/g, (_, char: string) => (char === 'n' ? '\n' : char === 't' ? '\t' : char))

// Wörterbuchschlüssel aller ta()-Aufrufe in Client-Komponenten: "Text" und, mit Zusatz, "Text|zusatz".
export function scanAdminClientKeys(root: string = 'src'): string[] {
  const keys = new Set<string>()
  const literal = String.raw`(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|\x60((?:[^\x60\\$]|\\.)*)\x60)`
  const call = new RegExp(String.raw`(?<![\w.])ta\(\s*${literal}(?:\s*,\s*'(\w+)')?`, 'g')
  for (const file of sourceFiles(root)) {
    if (file.includes(join('lib', 'i18n'))) continue
    const source = readFileSync(file, 'utf8')
    if (!source.includes('useAdminText')) continue
    for (const match of source.matchAll(call)) {
      const text = unescapeLiteral(match[1] ?? match[2] ?? match[3] ?? '')
      keys.add(text)
      if (match[4]) keys.add(`${text}|${match[4]}`)
    }
  }
  return [...keys].sort()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const keys = scanAdminClientKeys()
  writeFileSync(OUTPUT, JSON.stringify(keys, null, 2) + '\n')
  console.log(`${keys.length} Schlüssel nach ${OUTPUT} geschrieben`)
}
