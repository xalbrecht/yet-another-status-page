/**
 * Prüft, ob die Migrationen zum Schema der Payload-Konfiguration passen (Issue #16).
 *
 * Die E2E-Tests laufen im Entwicklungsmodus. Dort legt Payload das Schema aus der Konfiguration selbst an
 * (`push`), die Migrationen laufen nicht. Im Betrieb gelten nur die Migrationen. Fehlt dort eine Spalte,
 * merkt man es erst im Container (Issue #14).
 *
 * Ablauf: zwei leere Datenbanken anlegen. In A laufen alle Migrationen (`payload migrate`), in B legt der
 * Entwicklungsmodus das Schema an. Danach werden Tabellen, Spalten, Indizes, Constraints und Enums
 * verglichen. Unterschiede außerhalb von `ALLOWED` beenden das Skript mit Exit 1.
 *
 * Aufruf: `npm run check:migrations`. Die Adresse eines PostgreSQL-Servers kommt aus
 * `CHECK_MIGRATIONS_DATABASE_URL` (Vorgabe `postgres://postgres:test@localhost:5432/postgres`). Der Benutzer
 * braucht das Recht, Datenbanken anzulegen. Lokal genügt ein Wegwerf-Container:
 * `docker run -d --rm --name migcheck -e POSTGRES_PASSWORD=test -p 5432:5432 postgres:16-alpine`.
 */
import { spawnSync } from 'node:child_process'
import pg from 'pg'

/** Bekannte, harmlose Unterschiede aus älteren Migrationen. Die Liste bleibt kurz, ein neuer Unterschied fällt auf. */
const ALLOWED: { prefix: string; reason: string }[] = [
  { prefix: 'column settings.timezone ', reason: 'Migration legt varchar an, der Entwicklungsmodus einen Enum mit rund 400 Zeitzonen' },
  { prefix: 'enum enum_settings_timezone', reason: 'nur im Entwicklungsmodus vorhanden (siehe settings.timezone)' },
  { prefix: 'enum enum_settings_week_starts_on ', reason: 'Reihenfolge der Werte, ohne Wirkung' },
]

const adminUrl = process.env.CHECK_MIGRATIONS_DATABASE_URL || 'postgres://postgres:test@localhost:5432/postgres'
const suffix = `${Date.now()}`
const dbMigrated = `migcheck_a_${suffix}`
const dbPushed = `migcheck_b_${suffix}`

const urlFor = (db: string): string => {
  const u = new URL(adminUrl)
  u.pathname = `/${db}`
  return u.toString()
}

/** Beschreibung des Schemas als sortierte Textzeilen, je Zeile ein Objekt. */
async function describeSchema(url: string): Promise<Set<string>> {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    const lines = new Set<string>()
    const run = async (sql: string): Promise<Record<string, string>[]> => (await client.query(sql)).rows
    for (const r of await run(`
      select table_name t from information_schema.tables
      where table_schema = 'public' and table_name <> 'payload_migrations'`)) lines.add(`table ${r.t}`)
    for (const r of await run(`
      select table_name t, column_name c, data_type || coalesce('(' || character_maximum_length || ')', '') ty,
             case when udt_name like 'enum_%' then ' ' || udt_name else '' end u, is_nullable n,
             coalesce(column_default, '') d
      from information_schema.columns
      where table_schema = 'public' and table_name <> 'payload_migrations'`))
      lines.add(`column ${r.t}.${r.c} ${r.ty}${r.u} null=${r.n} default=${r.d}`)
    for (const r of await run(`
      select indexdef from pg_indexes
      where schemaname = 'public' and tablename <> 'payload_migrations'`)) lines.add(`index ${r.indexdef}`)
    for (const r of await run(`
      select c.conrelid::regclass::text t, c.conname n, pg_get_constraintdef(c.oid) d
      from pg_constraint c join pg_namespace ns on ns.oid = c.connamespace
      where ns.nspname = 'public' and c.conrelid::regclass::text <> 'payload_migrations'`))
      lines.add(`constraint ${r.t} ${r.n} ${r.d}`)
    for (const r of await run(`
      select t.typname n, string_agg(e.enumlabel, ',' order by e.enumsortorder) v
      from pg_type t join pg_enum e on e.enumtypid = t.oid
      join pg_namespace ns on ns.oid = t.typnamespace where ns.nspname = 'public'
      group by t.typname`)) lines.add(`enum ${r.n} (${r.v})`)
    return lines
  } finally {
    await client.end()
  }
}

function runStep(title: string, args: string[], databaseUri: string, env: NodeJS.ProcessEnv = {}): void {
  console.log(`\n== ${title}`)
  const res = spawnSync('npx', args, {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, PAYLOAD_SECRET: 'check-migrations', DATABASE_URI: databaseUri, ...env },
  })
  if (res.status !== 0) throw new Error(`${title} ist fehlgeschlagen (Exit ${res.status})`)
}

async function main(): Promise<number> {
  const admin = new pg.Client({ connectionString: adminUrl })
  await admin.connect()
  let code = 0
  try {
    await admin.query(`create database ${dbMigrated}`)
    await admin.query(`create database ${dbPushed}`)

    const started = Date.now()
    runStep('Datenbank A: alle Migrationen ausführen', ['payload', 'migrate'], urlFor(dbMigrated))
    runStep('Datenbank B: Schema im Entwicklungsmodus anlegen', ['tsx', 'scripts/check-migrations-push.mts'], urlFor(dbPushed), {
      NODE_ENV: 'development',
    })

    const [fromMigrations, fromConfig] = await Promise.all([describeSchema(urlFor(dbMigrated)), describeSchema(urlFor(dbPushed))])
    const onlyMigrations = [...fromMigrations].filter((l) => !fromConfig.has(l)).sort()
    const onlyConfig = [...fromConfig].filter((l) => !fromMigrations.has(l)).sort()

    const allowed = (l: string) => ALLOWED.find((a) => l.startsWith(a.prefix))
    const unexpected = [
      ...onlyMigrations.filter((l) => !allowed(l)).map((l) => `nur in den Migrationen:        ${l}`),
      ...onlyConfig.filter((l) => !allowed(l)).map((l) => `nur im Schema der Konfiguration: ${l}`),
    ]
    const known = [...onlyMigrations, ...onlyConfig].filter(allowed)

    console.log(`\n== Ergebnis (${Math.round((Date.now() - started) / 1000)} s, ${fromMigrations.size} / ${fromConfig.size} Schemaeinträge)`)
    if (known.length) {
      console.log(`Zugelassene Unterschiede: ${known.length}`)
      for (const l of known) console.log(`  ${l.length > 100 ? `${l.slice(0, 100)} …` : l}  [${allowed(l)!.reason}]`)
    }
    if (unexpected.length) {
      console.error(`\nFEHLER: ${unexpected.length} Unterschied(e) zwischen Migrationen und Schema der Konfiguration:`)
      for (const l of unexpected) console.error(`  ${l}`)
      code = 1
    } else {
      console.log('Migrationen und Schema der Konfiguration stimmen überein.')
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    code = 1
  } finally {
    await admin.query(`drop database if exists ${dbMigrated} with (force)`).catch(() => undefined)
    await admin.query(`drop database if exists ${dbPushed} with (force)`).catch(() => undefined)
    await admin.end()
  }
  return code
}

process.exit(await main())
