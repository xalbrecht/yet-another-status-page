import type { Metadata } from 'next'
import { t } from '@/lib/i18n'
import { redirect } from 'next/navigation'
import { addZonedDays, formatDateSlug, getWeekStart, resolveDateTimeConfig } from '@/lib/datetime'
import { getSettings } from '@/lib/payload'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings()
  
  const titleTemplate = settings.historyMetaTitle || t('history.metaTitle')
  const descriptionTemplate = settings.historyMetaDescription || t('history.metaDescription')
  
  const title = titleTemplate.replace(/\{\{siteName\}\}/g, settings.siteName)
  const description = descriptionTemplate.replace(/\{\{siteName\}\}/g, settings.siteName)

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function HistoryPage() {
  const settings = await getSettings()
  const dt = resolveDateTimeConfig(settings)
  const weekStart = getWeekStart(new Date(), dt.weekStartsOn, dt.timezone)
  const previousWeekStart = addZonedDays(weekStart, -7, dt.timezone)
  redirect(`/history/${formatDateSlug(previousWeekStart, dt.timezone)}`)
}
