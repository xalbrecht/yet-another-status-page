import { existsSync } from 'node:fs'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { headers } from 'next/headers'
import { sql } from '@payloadcms/db-postgres'
import config from '@payload-config'
import { requireRoles } from '@/lib/route-auth'
import { resolveDateTimeConfig } from '@/lib/datetime'
import { collectSystemInfo } from '@/lib/system-info'
import type { SqlRunner } from '@/lib/status-log-rebuild'
import { ta } from '@/lib/i18n/admin'
import packageJson from '../../../../package.json' with { type: 'json' }

/**
 * Angaben zum laufenden Stand (Image-Tag, Build-Datum, Commit, Version, Node, Startzeit, letzte Migration) für den
 * Admin-Bereich. Nur für angemeldete Nutzer, im Testmodus offen wie die übrigen Routen. Besucher der Statusseite
 * sollen Tag, Version und Migration nicht sehen.
 */
export async function GET() {
  try {
    const payload = await getPayload({ config })
    const auth = await requireRoles(payload, await headers(), ['admin'])
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

    const info = await collectSystemInfo({
      env: process.env,
      version: packageJson.version,
      nodeVersion: process.version,
      uptimeSeconds: process.uptime(),
      now: Date.now(),
      fileExists: existsSync,
      lastMigration: async () => {
        // Im Entwicklungsmodus legt Payload statt Migrationen die Zeile „dev“ an: das ist keine Migration
        const db = (payload.db as unknown as { drizzle: SqlRunner }).drizzle
        const result = await db.execute(sql`SELECT name FROM payload_migrations WHERE name <> 'dev' ORDER BY created_at DESC, id DESC LIMIT 1`)
        return (result.rows[0] as { name?: string } | undefined)?.name ?? null
      },
    })

    // Zeitzone und Format der Einstellungen, damit das Datum im Admin wie sonst angezeigt wird. Ohne Einstellungen gilt UTC.
    const settings = await payload.findGlobal({ slug: 'settings' }).catch(() => null)
    return NextResponse.json({ ...info, dateTime: resolveDateTimeConfig(settings) })
  } catch (error) {
    console.error('[system-info] failed:', error)
    return NextResponse.json({ error: ta('Unknown error') }, { status: 500 })
  }
}
