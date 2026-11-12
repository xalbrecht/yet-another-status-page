import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { headers } from 'next/headers'
import config from '@payload-config'
import { isTestMode } from '@/lib/access'
import { invalidateLagebild } from '@/lib/lagebild-invalidate'
import { convertMaintenanceIncidents } from '@/lib/maintenance-conversion'
import { ta } from '@/lib/i18n/admin'

/**
 * Wandelt als Störungen übernommene Wartungen in Wartungen um. Standard ist die Vorschau (`dryRun: true`),
 * geschrieben und gelöscht wird nur bei `dryRun: false`. Nur für angemeldete Nutzer, im Testmodus offen.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await headers() })
    if (!user && !isTestMode()) {
      return NextResponse.json({ error: ta('Authentication required') }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as { dryRun?: unknown }
    const dryRun = body.dryRun !== false

    const result = await convertMaintenanceIncidents(payload, { dryRun })
    if (!dryRun) invalidateLagebild()
    return NextResponse.json(result)
  } catch (error) {
    console.error('[status-log/convert-maintenance] failed:', error)
    return NextResponse.json({ error: ta('Unknown error') }, { status: 500 })
  }
}
