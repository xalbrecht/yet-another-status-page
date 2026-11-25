import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getTranslators } from '@/lib/i18n/server'
import { parseGroupChoice } from '@/lib/group-choice'

/**
 * Gruppenwahl eines Abonnenten ändern (#268). Abonnenten haben kein Konto, der `unsubscribeToken` aus der Mail ist der
 * einzige Zugang. Die Route liefert und ändert nur `allGroups` und `groups`, nie Adresse, Telefonnummer oder Token.
 * Unbekannter Token: 404 ohne Inhalt, damit die Antwort nichts über vorhandene Anmeldungen verrät.
 */

type Params = { params: Promise<{ token: string }> }

async function findByToken(token: string) {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'subscribers',
    where: { unsubscribeToken: { equals: token } },
    limit: 1,
    depth: 0,
  })
  return { payload, subscriber: result.docs[0] }
}

const groupIdsOf = (groups: unknown): number[] =>
  (Array.isArray(groups) ? groups : []).map((group) => Number(typeof group === 'object' && group ? (group as { id: unknown }).id : group))

const notFound = () => new NextResponse(null, { status: 404 })

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { token } = await params
    const { subscriber } = await findByToken(token)
    if (!subscriber) return notFound()
    return NextResponse.json({
      allGroups: subscriber.allGroups !== false,
      groups: groupIdsOf(subscriber.groups),
      active: Boolean(subscriber.active),
    })
  } catch (error) {
    console.error('Error reading subscription choice:', error)
    return NextResponse.json({ error: 'Failed to read subscription' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { t } = getTranslators()
    const { token } = await params
    const { payload, subscriber } = await findByToken(token)
    if (!subscriber) return notFound()
    if (!subscriber.active) {
      return NextResponse.json({ error: t('api.subscriptionInactive') }, { status: 409 })
    }

    const body = await request.json().catch(() => null)
    const knownGroups = await payload.find({ collection: 'service-groups', depth: 0, pagination: false })
    const choice = parseGroupChoice(body, knownGroups.docs.map((group) => Number(group.id)))
    if (!choice.ok) {
      return NextResponse.json({ error: t(choice.error) }, { status: 400 })
    }

    await payload.update({
      collection: 'subscribers',
      id: subscriber.id,
      data: { allGroups: choice.allGroups, groups: choice.groups },
      depth: 0,
    })
    return NextResponse.json({ allGroups: choice.allGroups, groups: choice.groups, active: true })
  } catch (error) {
    console.error('Error updating subscription choice:', error)
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
  }
}
