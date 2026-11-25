import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { deliverableSubscribersWhere, groupsForDelivery } from '@/lib/subscriber-filter'
import { requireRoles } from '@/lib/route-auth'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const auth = await requireRoles(payload, await headers(), ['admin', 'servicedesk'])
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })
    const { searchParams } = new URL(request.url)
    const channel = searchParams.get('channel') || 'both'

    // Mit `notification`: nur Abonnenten, deren Wahl zu den Dienstgruppen dieser Benachrichtigung passt. Gelesen wird
    // mit den Rechten des Benutzers, ein Entwurf fremder Dienstgruppen ergibt 404.
    let groups: number[] = []
    const notificationId = searchParams.get('notification')
    if (notificationId) {
      const notification = await payload.findByID({
        collection: 'notifications',
        id: notificationId,
        depth: 0,
        user: auth.user,
        overrideAccess: false,
        disableErrors: true,
      })
      if (!notification) return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
      groups = await groupsForDelivery(payload, notification)
    }

    let count = 0

    if (channel === 'email' || channel === 'both') {
      const emailCount = await payload.count({
        collection: 'subscribers',
        where: deliverableSubscribersWhere('email', groups),
      })
      count += emailCount.totalDocs
    }

    if (channel === 'sms' || channel === 'both') {
      const smsCount = await payload.count({
        collection: 'subscribers',
        where: deliverableSubscribersWhere('sms', groups),
      })
      count += smsCount.totalDocs
    }

    return NextResponse.json({ count })
  } catch (error) {
    console.error('Error counting subscribers:', error)
    return NextResponse.json({ count: 0, error: 'Failed to count subscribers' }, { status: 500 })
  }
}
