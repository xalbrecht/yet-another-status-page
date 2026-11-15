import { getCachedPayload, getSettings } from '@/lib/payload'
import { incidentEntry, maintenanceEntry, renderAtom } from '@/lib/feeds/atom'
import { handle, text } from '@/lib/api/v1/respond'
import { getTranslators } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export const GET = handle(async (request) => {
  const payload = await getCachedPayload()
  const [settings, incidents, maintenances] = await Promise.all([
    getSettings(),
    payload.find({ collection: 'incidents', sort: '-updatedAt', limit: 30, depth: 0 }),
    payload.find({ collection: 'maintenances', sort: '-updatedAt', limit: 30, depth: 0 }),
  ])

  const { t, tf, lang } = getTranslators()
  const entries = [...incidents.docs.map((doc) => incidentEntry(doc, t)), ...maintenances.docs.map((doc) => maintenanceEntry(doc, t))]
    .sort((a, b) => b.updated.localeCompare(a.updated))
    .slice(0, 50)

  return text(request, renderAtom(settings.siteName, '/feed.atom', entries, { tf, lang }), 'application/atom+xml; charset=utf-8')
})
