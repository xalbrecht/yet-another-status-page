import { getCachedPayload, getSettings } from '@/lib/payload'
import { ACTIVE_MAINTENANCE_WHERE } from '@/lib/api/v1/queries'
import { renderIcs } from '@/lib/feeds/ical'
import { handle, text } from '@/lib/api/v1/respond'
import { getTranslators } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

const HISTORY_DAYS = 30

export const GET = handle(async (request) => {
  const payload = await getCachedPayload()
  const since = new Date(Date.now() - HISTORY_DAYS * 86400 * 1000).toISOString()

  const [settings, maintenances] = await Promise.all([
    getSettings(),
    payload.find({
      collection: 'maintenances',
      where: { or: [ACTIVE_MAINTENANCE_WHERE, { scheduledStartAt: { greater_than_equal: since } }] },
      sort: 'scheduledStartAt',
      depth: 1,
      limit: 200,
    }),
  ])

  const { t } = getTranslators()
  return text(request, renderIcs(settings.siteName, maintenances.docs, t), 'text/calendar; charset=utf-8', 'public, max-age=300')
})
