import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { headers } from 'next/headers'
import config from '@payload-config'
import { sendNotificationDraft } from '@/lib/notifications/send-draft'
import { ta } from '@/lib/i18n/admin'
import { notificationGroupIds } from '@/lib/access'
import { requireRoles } from '@/lib/route-auth'
import { scopeAllows, type RoleUser } from '@/lib/roles'

interface SendRequest {
  notificationId: string | number
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })

    // Verify user is authenticated
    const headersList = await headers()
    const auth = await requireRoles(payload, headersList, ['admin', 'servicedesk'])

    // Nur Admin und ServiceDesk, auch im Testmodus nur mit Anmeldung
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })
    if (!auth.user) return NextResponse.json({ error: ta('Authentication required') }, { status: 401 })

    const body: SendRequest = await request.json()
    const { notificationId } = body

    if (!notificationId) {
      return NextResponse.json({ error: ta('Missing notificationId') }, { status: 400 })
    }

    // ServiceDesk sendet nur Entwürfe zu Meldungen seiner Dienstgruppen (alle Dienste der Meldung in den erlaubten Gruppen)
    const draft = await payload.findByID({ collection: 'notifications', id: notificationId, depth: 0, overrideAccess: true, disableErrors: true })
    if (draft) {
      const groups = await notificationGroupIds(payload, draft)
      if (!scopeAllows(auth.user as RoleUser, ['servicedesk'], groups ?? [], 'all')) {
        return NextResponse.json({ error: ta('You do not have permission for this action') }, { status: 403 })
      }
    }

    const result = await sendNotificationDraft(payload, notificationId)
    if (!result.ok) {
      if (result.reason === 'not-found') {
        return NextResponse.json({ error: ta('Notification not found') }, { status: 404 })
      }
      if (result.reason === 'already-sent') {
        return NextResponse.json({ error: ta('Notification has already been sent') }, { status: 400 })
      }
      return NextResponse.json({ error: ta('Notification is currently being processed') }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Notification sent successfully',
      totalRecipients: result.totalRecipients,
      status: result.status,
    })
  } catch (error) {
    console.error('Error sending notification:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : ta('Failed to send notification') },
      { status: 500 }
    )
  }
}
