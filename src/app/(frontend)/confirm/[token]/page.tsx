import { getPayload } from 'payload'
import { tf } from '@/lib/i18n'
import config from '@payload-config'
import type { Metadata } from 'next'
import { ConfirmClient } from './ConfirmClient'
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
  const siteName = settings.siteName || 'Status Page'

  return {
    title: tf('confirm.metaTitle', { siteName }),
    robots: { index: false, follow: false },
  }
}

interface ConfirmPageProps {
  params: Promise<{ token: string }>
}

export default async function ConfirmPage({ params }: ConfirmPageProps) {
  const { token } = await params
  const payload = await getPayload({ config })
  const settings = await getSettings()
  const siteName = settings.siteName || 'Status Page'

  // Only looks the token up. The click on the button confirms (POST), so link scanners
  // that fetch the page do not confirm anything.
  const result = await payload.find({
    collection: 'subscribers',
    where: {
      and: [
        { verificationToken: { equals: token } },
        { type: { equals: 'email' } },
      ],
    },
    limit: 1,
  })

  const subscriber = token.length >= 10 ? result.docs[0] : undefined

  return (
    <ConfirmClient
      siteName={siteName}
      status={subscriber ? 'pending' : 'invalid'}
      token={token}
      email={subscriber?.email}
    />
  )
}
