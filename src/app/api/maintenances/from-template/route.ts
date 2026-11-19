import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { headers } from 'next/headers'
import config from '@payload-config'
import { isTestMode } from '@/lib/access'
import { checkMaintenanceInput } from '@/lib/maintenance-draft'
import { ta } from '@/lib/i18n/admin'
import { activeServiceWhereNow } from '@/lib/service-lifecycle'
import { getServerUrl } from '@/lib/utils'

/**
 * Legt eine Wartung an, deren Titel und Ankündigung die geführte Seite „Neu erstellen mit Vorlage“ aus einer Vorlage gefüllt hat.
 * Die Wartung entsteht wie im Formular „Wartungen“ (Zeitplan, Statusprotokoll, Benachrichtigungsentwurf, Ersetzen von `{{link}}`)
 * mit dem Status „geplant“. Die Ankündigung ist die erste Aktualisierung, SMS- und ntfy-Text gelangen in den Entwurf.
 * Nur für angemeldete Nutzer, im Testmodus offen wie die übrigen Routen.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await headers() })
    if (!user && !isTestMode()) {
      return NextResponse.json({ error: ta('Authentication required') }, { status: 401 })
    }

    const check = checkMaintenanceInput(await request.json().catch(() => null))
    if (!check.ok) {
      return NextResponse.json({ error: ta('The input is incomplete or invalid.'), fields: check.errors }, { status: 400 })
    }
    const { title, message, maintenanceKind, affectsService, serviceIds, start, end, smsBody, ntfyBody } = check.value

    // Jeder gewählte Dienst muss es geben und aktiv sein (beendete und noch nicht begonnene Dienste bietet die Seite nicht an)
    const found = await payload.count({
      collection: 'services',
      where: { and: [{ id: { in: serviceIds } }, activeServiceWhereNow()] },
    })
    if (found.totalDocs !== serviceIds.length) {
      return NextResponse.json({ error: ta('The input is incomplete or invalid.'), fields: ['serviceIds'] }, { status: 400 })
    }

    const maintenance = await payload.create({
      collection: 'maintenances',
      draft: false,
      data: {
        title,
        maintenanceKind,
        ...(affectsService ? { affectsService } : {}),
        status: 'upcoming',
        scheduledStartAt: start,
        ...(end ? { scheduledEndAt: end } : {}),
        affectedServices: serviceIds,
        updates: [{ status: 'upcoming', message, createdAt: new Date().toISOString(), ...(smsBody ? { smsBody } : {}), ...(ntfyBody ? { ntfyBody } : {}) }],
      },
      user: user ?? undefined,
      overrideAccess: false,
      depth: 0,
    })
    return NextResponse.json({ id: maintenance.id, shortId: maintenance.shortId, url: `${getServerUrl()}/m/${maintenance.shortId}` }, { status: 201 })
  } catch (error) {
    console.error('[maintenances/from-template] failed:', error)
    return NextResponse.json({ error: ta('Unknown error') }, { status: 500 })
  }
}
