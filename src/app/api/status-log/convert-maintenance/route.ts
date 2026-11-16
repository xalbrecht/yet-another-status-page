import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { headers } from 'next/headers'
import config from '@payload-config'
import { isTestMode } from '@/lib/access'
import { invalidateLagebild } from '@/lib/lagebild-invalidate'
import { convertMaintenanceIncidents } from '@/lib/maintenance-conversion'
import { ta } from '@/lib/i18n/admin'
import { normalizeRules } from '@/lib/incident-classification'
import { parseExpected, previewChangedMessage, PreviewChangedError } from '@/lib/preview-check'

/**
 * Wandelt als Störungen übernommene Wartungen in Wartungen um. Standard ist die Vorschau (`dryRun: true`),
 * geschrieben und gelöscht wird nur bei `dryRun: false`. Dann gehört `expect` (das Feld `check` der Vorschau) in den
 * Körper: Der Server rechnet die Vorschau neu und ändert nichts, wenn sie abweicht (HTTP 409). Nur für angemeldete
 * Nutzer, im Testmodus offen.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await headers() })
    if (!user && !isTestMode()) {
      return NextResponse.json({ error: ta('Authentication required') }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as { dryRun?: unknown; expect?: unknown }
    const dryRun = body.dryRun !== false
    const expect = parseExpected(body.expect)
    if (!dryRun && !expect) {
      return NextResponse.json({ error: ta('Run the preview first.') }, { status: 400 })
    }

    const rules = normalizeRules((await payload.findGlobal({ slug: 'settings' })).classificationRules)
    const result = await convertMaintenanceIncidents(payload, { dryRun, rules, expect })
    if (!dryRun) invalidateLagebild()
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof PreviewChangedError) {
      return NextResponse.json({ error: previewChangedMessage(error, ta) }, { status: 409 })
    }
    console.error('[status-log/convert-maintenance] failed:', error)
    return NextResponse.json({ error: ta('Unknown error') }, { status: 500 })
  }
}
