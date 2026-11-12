import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { headers } from 'next/headers'
import config from '@payload-config'
import { isTestMode } from '@/lib/access'
import { loadReport } from '@/lib/report/load'
import { ta } from '@/lib/i18n/admin'

/**
 * Daten der Berichtsseite als JSON. Nur für angemeldete Nutzer, im Testmodus offen wie die übrigen Routen.
 * Ungültige Eingaben ergeben Status 400 mit einem Fehlertext.
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await headers() })
    if (!user && !isTestMode()) {
      return NextResponse.json({ error: ta('Authentication required') }, { status: 401 })
    }

    const search: Record<string, string | string[] | undefined> = {}
    for (const key of new Set(request.nextUrl.searchParams.keys())) {
      const values = request.nextUrl.searchParams.getAll(key)
      search[key] = values.length > 1 ? values : values[0]
    }

    const result = await loadReport(payload, search)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    if (result.data.error) return NextResponse.json({ error: result.data.error }, { status: 400 })
    return NextResponse.json({ ...result.data, period: result.period, params: result.params })
  } catch (error) {
    console.error('[availability-report] failed:', error)
    return NextResponse.json({ error: ta('Unknown error') }, { status: 500 })
  }
}
