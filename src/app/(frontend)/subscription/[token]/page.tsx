import { getPayload } from 'payload'
import { translatorsFor } from '@/lib/i18n/server'
import config from '@payload-config'
import type { Metadata } from 'next'
import { SubscriptionClient } from './SubscriptionClient'
import type { Setting } from '@/payload-types'

export const dynamic = 'force-dynamic'

async function getSettings() {
  const payload = await getPayload({ config })
  return await payload.findGlobal({
    slug: 'settings',
    depth: 0,
  }) as Setting
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings()
  const { tf } = translatorsFor()
  const siteName = settings.siteName || 'Status Page'

  return {
    title: tf('subpref.metaTitle', { siteName }),
    description: tf('subpref.metaDescription', { siteName }),
    // Der Link enthält ein Geheimnis (Token): nicht indexieren
    robots: { index: false, follow: false },
  }
}

interface SubscriptionPageProps {
  params: Promise<{ token: string }>
}

export default async function SubscriptionPage({ params }: SubscriptionPageProps) {
  const { token } = await params
  const payload = await getPayload({ config })
  const settings = await getSettings()
  const siteName = settings.siteName || 'Status Page'

  const result = await payload.find({
    collection: 'subscribers',
    where: { unsubscribeToken: { equals: token } },
    limit: 1,
    depth: 0,
  })
  const subscriber = result.docs[0]

  // Unbekannter Token: nichts preisgeben, keine Gruppenliste laden
  if (!subscriber) {
    return <SubscriptionClient siteName={siteName} status="not-found" token={token} />
  }
  if (!subscriber.active) {
    return <SubscriptionClient siteName={siteName} status="inactive" token={token} />
  }

  const groups = await payload.find({
    collection: 'service-groups',
    depth: 0,
    pagination: false,
    sort: 'name',
  })

  return (
    <SubscriptionClient
      siteName={siteName}
      status="active"
      token={token}
      subscriberContact={subscriber.type === 'email' ? subscriber.email : subscriber.phone}
      groups={groups.docs.map((group) => ({ id: Number(group.id), name: group.name }))}
      initialChoice={{
        allGroups: subscriber.allGroups !== false,
        groups: (subscriber.groups ?? []).map((group) => Number(typeof group === 'object' ? group.id : group)),
      }}
    />
  )
}
