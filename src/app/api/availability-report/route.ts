import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { headers } from 'next/headers'
import config from '@payload-config'
import { requireRoles } from '@/lib/route-auth'
import { loadReport } from '@/lib/report/load'
import { reportScopeOf } from '@/lib/report/scope'
import type { RoleUser } from '@/lib/roles'
import { ta } from '@/lib/i18n/admin'

/**
 * Daten der Berichtsseite als JSON. Nur für angemeldete Nutzer, im Testmodus offen wie die übrigen Routen.
 * Ungültige Eingaben ergeben Status 400 mit einem Fehlertext.
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const auth = await requireRoles(payload, await headers(), ['admin', 'produktmanager'])
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

    const search: Record<string, string | string[] | undefined> = {}
    for (const key of new Set(request.nextUrl.searchParams.keys())) {
      const values = request.nextUrl.searchParams.getAll(key)
      search[key] = values.length > 1 ? values : values[0]
    }

    const result = await loadReport(payload, search, Date.now(), reportScopeOf(auth.user as RoleUser))
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    if (result.data.error) return NextResponse.json({ error: result.data.error }, { status: 400 })
    return NextResponse.json({ ...result.data, period: result.period, params: result.params })
  } catch (error) {
    console.error('[availability-report] failed:', error)
    return NextResponse.json({ error: ta('Unknown error') }, { status: 500 })
  }
}
