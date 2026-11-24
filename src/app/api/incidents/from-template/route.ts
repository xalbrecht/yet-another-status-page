import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { headers } from 'next/headers'
import config from '@payload-config'
import { requireRoles } from '@/lib/route-auth'
import { checkIncidentInput } from '@/lib/incident-draft'
import { ta } from '@/lib/i18n/admin'
import { activeServiceWhereNow } from '@/lib/service-lifecycle'
import { getServerUrl } from '@/lib/utils'

/**
 * Legt eine Störung an, deren Titel und Texte die geführte Seite „Neu erstellen mit Vorlage“ aus einer Vorlage gefüllt hat.
 * Die Störung entsteht wie im Formular „Störungen“ (Dienstzustand, Statusprotokoll, Benachrichtigungsentwurf, Ersetzen von
 * `{{link}}`), mit dem Status „wird untersucht“. SMS- und ntfy-Text gelangen in den Benachrichtigungsentwurf.
 * Nur für angemeldete Nutzer, im Testmodus offen wie die übrigen Routen.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const auth = await requireRoles(payload, await headers(), ['admin', 'servicedesk'])
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })
    const user = auth.user

    const check = checkIncidentInput(await request.json().catch(() => null))
    if (!check.ok) {
      return NextResponse.json({ error: ta('The input is incomplete or invalid.'), fields: check.errors }, { status: 400 })
    }
    const { title, message, impact, createNotificationDraft, serviceIds, smsBody, ntfyBody } = check.value

    // Jeder gewählte Dienst muss es geben und aktiv sein (wie im Assistenten: beendete und noch nicht begonnene Dienste bietet er nicht an)
    const found = await payload.count({
      collection: 'services',
      where: { and: [{ id: { in: serviceIds } }, activeServiceWhereNow()] },
    })
    if (found.totalDocs !== serviceIds.length) {
      return NextResponse.json({ error: ta('The input is incomplete or invalid.'), fields: ['serviceIds'] }, { status: 400 })
    }

    const incident = await payload.create({
      collection: 'incidents',
      draft: false,
      data: {
        title,
        impact,
        status: 'investigating',
        affectedServices: serviceIds,
        updates: [{ status: 'investigating', message, createdAt: new Date().toISOString(), ...(createNotificationDraft === false ? { createNotificationDraft } : {}), ...(smsBody ? { smsBody } : {}), ...(ntfyBody ? { ntfyBody } : {}) }],
      },
      user: user ?? undefined,
      overrideAccess: false,
      depth: 0,
    })
    return NextResponse.json({ id: incident.id, shortId: incident.shortId, url: `${getServerUrl()}/i/${incident.shortId}` }, { status: 201 })
  } catch (error) {
    console.error('[incidents/from-template] failed:', error)
    return NextResponse.json({ error: ta('Unknown error') }, { status: 500 })
  }
}
