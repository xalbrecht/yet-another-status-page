/**
 * Angaben zum laufenden Stand für den Admin-Bereich: Image-Tag, Build-Datum und Commit (nur wenn das Image sie mitbringt),
 * dazu Angaben, die es immer gibt (Version, Node, Startzeit, Container, letzte Migration). Fehlt etwas oder scheitert
 * eine Abfrage, bleibt der Wert leer (`null`), die Seite zeigt dann „unbekannt“. Die Funktionen nutzen kein Node-Modul
 * und sind im Browser lauffähig, die Abfragen von Umgebung, Dateisystem und Datenbank kommen von außen.
 */
export type SystemInfo = {
  /** `null`: kein YASP-Image (Entwicklung, Helm-Chart, Upstream-Image). Einzelne Felder sind `null`, wenn sie nicht gesetzt oder ungültig sind. */
  image: { tag: string | null; date: string | null; commit: string | null } | null
  /** Version aus `package.json` */
  version: string
  node: string
  /** Startzeit des Prozesses (ISO, UTC) */
  startedAt: string
  /** `null`: nicht feststellbar */
  container: boolean | null
  /** Name der zuletzt angewandten Migration, `null`: nicht abfragbar oder keine vorhanden */
  lastMigration: string | null
}

export type SystemInfoSources = {
  env: Record<string, string | undefined>
  version: string
  nodeVersion: string
  uptimeSeconds: number
  now: number
  fileExists: (path: string) => boolean
  lastMigration: () => Promise<string | null>
}

const MAX_LENGTH = 200

const clean = (value: string | undefined): string | null => {
  const trimmed = value?.trim()
  return trimmed ? trimmed.slice(0, MAX_LENGTH) : null
}

export async function collectSystemInfo(sources: SystemInfoSources): Promise<SystemInfo> {
  const tag = clean(sources.env.YASP_BUILD_TAG)
  const rawDate = clean(sources.env.YASP_BUILD_DATE)
  const commit = clean(sources.env.YASP_BUILD_COMMIT)
  const parsedDate = rawDate !== null ? new Date(rawDate) : null
  const date = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null

  let container: boolean | null = null
  try {
    container = sources.fileExists('/.dockerenv')
  } catch {
    // nicht feststellbar
  }

  let lastMigration: string | null = null
  try {
    lastMigration = (await sources.lastMigration()) || null
  } catch {
    // Datenbank nicht abfragbar
  }

  return {
    image: tag === null && rawDate === null && commit === null ? null : { tag, date, commit },
    version: sources.version,
    node: sources.nodeVersion,
    startedAt: new Date(sources.now - sources.uptimeSeconds * 1000).toISOString(),
    container,
    lastMigration,
  }
}

/** Kurzer Commit (7 Zeichen), wie ihn `git rev-parse --short HEAD` liefert. */
export const shortCommit = (commit: string): string => commit.slice(0, 7)

type Text = (en: string) => string

/** Zeile im Fuß der Seitenleiste: Tag und Datum, oder Version und der Vermerk „kein YASP-Image“. */
export function summaryLine(info: SystemInfo, formatDate: (iso: string) => string, ta: Text): string {
  if (info.image === null) return `v${info.version} · ${ta('Development build, no YASP image')}`
  const parts = [info.image.tag ?? ta('unknown'), info.image.date ? formatDate(info.image.date) : null]
  return parts.filter((part): part is string => part !== null).join(' · ')
}
