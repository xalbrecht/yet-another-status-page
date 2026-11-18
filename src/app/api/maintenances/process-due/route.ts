import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { headers } from 'next/headers'
import config from '@payload-config'
import { isTestMode } from '@/lib/access'
import { processDueMaintenances } from '@/lib/maintenance/process-due'
import { ta } from '@/lib/i18n/admin'

export const dynamic = 'force-dynamic'

/**
 * Stellt fällige Wartungen sofort um (sonst übernimmt das der Zeitgeber im Server, jede Minute). Nur für angemeldete Nutzer,
 * im Testmodus offen wie die übrigen Routen. Die Umstellung ist unabhängig vom Aufrufer: Es gelten Zeitplan und Haken der Wartung.
 */
export async function POST() {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await headers() })
    if (!user && !isTestMode()) {
      return NextResponse.json({ error: ta('Authentication required') }, { status: 401 })
    }
    return NextResponse.json(await processDueMaintenances(payload))
  } catch (error) {
    console.error('[maintenances/process-due] failed:', error)
    return NextResponse.json({ error: ta('Unknown error') }, { status: 500 })
  }
}
