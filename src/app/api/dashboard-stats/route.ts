import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getIncidentStatus } from '@/collections/Incidents'
import { pendingSubscribersWhere } from '@/lib/subscriber-filter'
import { requireRoles } from '@/lib/route-auth'
import { ROLES, hasRole, type RoleUser } from '@/lib/roles'

const none = Promise.resolve({ totalDocs: 0 })

export async function GET() {
  try {
    const payload = await getPayload({ config })
    const auth = await requireRoles(payload, await headers(), ROLES)
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })
    // Abonnenten zählen nur Admins, Benachrichtigungen Admins und ServiceDesk (ohne Anmeldung im Testmodus alles)
    const user = auth.user as RoleUser
    const isAdmin = !user || hasRole(user, 'admin')
    const canNotify = isAdmin || hasRole(user, 'servicedesk')

    // Fetch all stats in parallel
    const [
      pendingNotifications,
      scheduledNotifications,
      emailSubscribers,
      smsSubscribers,
      pendingSubscribers,
      allIncidents,
      upcomingMaintenances,
    ] = await Promise.all([
      // Draft notifications
      canNotify ? payload.count({
        collection: 'notifications',
        where: { status: { equals: 'draft' } },
      }) : none,
      // Scheduled notifications
      canNotify ? payload.count({
        collection: 'notifications',
        where: { status: { equals: 'scheduled' } },
      }) : none,
      // Email subscribers (active only)
      isAdmin ? payload.count({
        collection: 'subscribers',
        where: {
          and: [
            { type: { equals: 'email' } },
            { active: { equals: true } },
          ],
        },
      }) : none,
      // SMS subscribers (active only)
      isAdmin ? payload.count({
        collection: 'subscribers',
        where: {
          and: [
            { type: { equals: 'sms' } },
            { active: { equals: true } },
          ],
        },
      }) : none,
      // Subscribers waiting for approval (email also: address confirmation)
      isAdmin ? payload.count({
        collection: 'subscribers',
        where: pendingSubscribersWhere(),
      }) : none,
      // Fetch all incidents to compute active count
      // (Incidents don't have a top-level status field - it's derived from updates)
      payload.find({
        collection: 'incidents',
        limit: 0, // We only need docs for filtering, not pagination
      }),
      // Upcoming maintenances
      payload.count({
        collection: 'maintenances',
        where: {
          or: [
            { status: { equals: 'upcoming' } },
            { status: { equals: 'in_progress' } },
          ],
        },
      }),
    ])

    // Count active incidents (status derived from last update, not 'resolved')
    const activeIncidentsCount = allIncidents.docs.filter((incident) => {
      const status = getIncidentStatus(incident.updates as Array<{ status?: string }> | undefined)
      return status !== 'resolved'
    }).length

    return NextResponse.json({
      pendingNotifications: pendingNotifications.totalDocs,
      scheduledNotifications: scheduledNotifications.totalDocs,
      emailSubscribers: emailSubscribers.totalDocs,
      smsSubscribers: smsSubscribers.totalDocs,
      pendingSubscribers: pendingSubscribers.totalDocs,
      activeIncidents: activeIncidentsCount,
      upcomingMaintenances: upcomingMaintenances.totalDocs,
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
}
