import { activeServiceWhereNow } from '@/lib/service-lifecycle'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getIncidentStatus } from '@/collections/Incidents'
import { getCachedPayload, getSettings } from '@/lib/payload'
import { computeOverallStatus, visibleMaintenanceWhere, type ServiceStatus } from '@/lib/status-data'
import { cn, getMediaUrl } from '@/lib/utils'
import { Header } from '@/components/status/Header'
import { Footer } from '@/components/status/Footer'
import { translatorsFor } from '@/lib/i18n/server'
import { countMaintenanceServices, maintenanceBarText, maintenanceNoticeTextFor, noticeMaintenanceWhere, toNoticeMaintenance } from '@/lib/maintenance-notice'
import { Subscribe } from '@/components/status/SubscribeDialog'
import { LoginButton } from '@/components/status/LoginButton'
import { StatusBanner } from '@/components/status/StatusBanner'
import { MaintenanceBar } from '@/components/status/MaintenanceBar'
import { ServiceGroup } from '@/components/status/ServiceGroup'
import { MaintenanceCard } from '@/components/status/MaintenanceCard'
import { IncidentTimelineWithLinks } from '@/components/status/IncidentTimeline'
import { StatusLegend } from '@/components/status/StatusLegend'
import { Lagebild } from '@/components/status/lagebild/Lagebild'
import { StatusBoxes } from '@/components/status/StatusBoxes'
import { loadLagebildCached } from '@/lib/lagebild-cache'
import { autoRefreshProps, cacheMinutesSetting } from '@/lib/auto-refresh'
import { parseBarHours, parsePeriodDays, type BarHours, type PeriodDays } from '@/lib/lagebild'
import {
  buildIncidentItems,
  isOpenIncident,
  buildMaintenanceItems,
  parseBoxContent,
  parseBoxEntries,
  parseBoxesPlacement,
} from '@/lib/status-boxes'
import {
  addZonedDays,
  formatDate,
  formatDateSlug,
  formatDateTime,
  formatTime,
  resolveDateTimeConfig,
} from '@/lib/datetime'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings()
  const { tf } = translatorsFor()

  const title = settings.metaTitle || tf('meta.homeTitle', { siteName: settings.siteName })
  const description = settings.metaDescription || `Real-time status and incident updates for ${settings.siteName} services`

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

async function getStatusData(requestedPeriod: unknown, requestedBar: unknown) {
  const payload = await getCachedPayload()
  const settings = await getSettings()
  const { t, tf, lang } = translatorsFor()
  const dt = resolveDateTimeConfig(settings)

  const serviceGroups = await payload.find({
    collection: 'service-groups',
    depth: 2,
    sort: '_order',
    pagination: false,
  })

  const services = await payload.find({
    collection: 'services',
    where: activeServiceWhereNow(),
    depth: 1,
    sort: '_order',
    pagination: false,
  })

  const maintenances = await payload.find({
    collection: 'maintenances',
    where: visibleMaintenanceWhere(settings),
    sort: 'scheduledStartAt',
    limit: 10,
  })

  // Wartungen für die Anzeige am Dienst: noch nicht beendet und in den nächsten 24 Stunden beginnend. Der Status wird beim
  // Lesen nach Zeitplan umgestellt, deshalb filtert maintenanceNoticeTextFor noch einmal nach dem gelesenen Status.
  const nowMs = Date.now()
  const noticeMaintenances = await payload.find({
    collection: 'maintenances',
    where: noticeMaintenanceWhere(nowMs),
    depth: 0,
    pagination: false,
  })
  const noticeInput = noticeMaintenances.docs.map(toNoticeMaintenance)
  // Das Lagebild kommt aus dem Zwischenspeicher, der Hinweis nicht: Er wird je Aufruf berechnet und als Zuordnung übergeben.
  const maintenanceNotices: Record<string, string> = {}
  for (const service of services.docs) {
    const text = maintenanceNoticeTextFor(noticeInput, String(service.id), nowMs, dt, { t, tf })
    if (text) maintenanceNotices[String(service.id)] = text
  }

  const incidents = await payload.find({
    collection: 'incidents',
    sort: '-createdAt',
    limit: 50,
  })

  // Group services by service group
  const shownServiceIds: string[] = []
  const groupedServices = serviceGroups.docs.map((group) => {
    const groupServices = services.docs.filter((service) => {
      const serviceGroup = service.group
      if (typeof serviceGroup === 'object' && serviceGroup !== null) {
        return serviceGroup.id === group.id
      }
      return serviceGroup === group.id
    })

    for (const service of groupServices) shownServiceIds.push(String(service.id))

    return {
      name: group.name,
      services: groupServices.map((service) => ({
        name: service.name,
        status: (service.status || 'operational') as ServiceStatus,
        description: service.description || undefined,
        maintenanceNotice: maintenanceNotices[String(service.id)],
      })),
    }
  }).filter((group) => group.services.length > 0)

  // Wartungsleiste: zählt nur Dienste, die auf der Seite stehen (in einer Gruppe).
  const maintenanceBar = maintenanceBarText(countMaintenanceServices(noticeInput, shownServiceIds), tf)

  // Format maintenances
  const formattedMaintenances = maintenances.docs.map((m) => {
    const scheduledStart = new Date(m.scheduledStartAt)
    const scheduledEnd = m.scheduledEndAt ? new Date(m.scheduledEndAt) : null
    
    let durationText = m.duration || ''
    if (!durationText && scheduledEnd) {
      const durationMs = scheduledEnd.getTime() - scheduledStart.getTime()
      const durationHours = Math.round(durationMs / (1000 * 60 * 60))
      durationText = `~${durationHours} hour${durationHours !== 1 ? 's' : ''}`
    }

    const updates = (m.updates || []).map((update, index) => ({
      id: `${m.id}-update-${index}`,
      status: update.status,
      message: update.message || '',
      timestamp: formatTime(new Date(update.createdAt), dt),
    })).reverse()

    return {
      id: String(m.id),
      shortId: m.shortId || '',
      title: m.title,
      description: m.description,
      scheduledAt: formatDateTime(scheduledStart, dt),
      duration: durationText,
      affectedServices: (m.affectedServices || []).map((s) => {
        if (typeof s === 'object' && s !== null) {
          return s.name
        }
        return String(s)
      }),
      status: m.status,
      updates,
    }
  })

  // Group incidents by day
  const incidentsByDay = new Map<string, { incidents: typeof formattedIncidents, dateSlug: string }>()

  const today = new Date()
  for (let i = 0; i < 5; i++) {
    const date = addZonedDays(today, -i, dt.timezone)
    incidentsByDay.set(formatDate(date, dt), { incidents: [], dateSlug: formatDateSlug(date, dt.timezone) })
  }

  const formatIncident = (incident: (typeof incidents.docs)[number]) => ({
    id: String(incident.id),
    shortId: incident.shortId || '',
    title: incident.title,
    status: getIncidentStatus(incident.updates) as ServiceStatus,
    resolved: getIncidentStatus(incident.updates) === 'resolved',
    updates: (incident.updates || []).map((update, index) => ({
      id: `${incident.id}-update-${index}`,
      status: update.status as 'investigating' | 'identified' | 'monitoring' | 'resolved',
      message: update.message || '',
      timestamp: formatTime(new Date(update.createdAt), dt),
    })).reverse(),
    createdAt: new Date(incident.createdAt),
  })
  const formattedIncidents = incidents.docs.map(formatIncident)
  // Felder, die nur dem Gruppieren und Filtern dienen, gehören nicht an die Anzeige
  const forDisplay = ({ createdAt: _createdAt, resolved: _resolved, ...rest }: ReturnType<typeof formatIncident>) => rest

  formattedIncidents.forEach((incident) => {
    const dateKey = formatDate(incident.createdAt, dt)
    if (incidentsByDay.has(dateKey)) {
      incidentsByDay.get(dateKey)!.incidents.push(incident)
    }
  })

  const pastIncidents = Array.from(incidentsByDay.entries()).map(
    ([date, { incidents, dateSlug }]) => ({
      date,
      dateSlug,
      incidents: incidents.map(forDisplay),
    })
  )
  // Nur gelöste Störungen, für den Block „Vergangene Störungen“ neben den Boxen
  const pastResolvedIncidents = Array.from(incidentsByDay.entries()).map(
    ([date, { incidents, dateSlug }]) => ({
      date,
      dateSlug,
      incidents: incidents.filter((incident) => incident.resolved).map(forDisplay),
    })
  )

  const overallStatus = computeOverallStatus(services.docs, settings)

  // Lagebild nur laden, wenn es in den Website-Einstellungen aktiviert ist
  const lagebildVariant = settings.lagebildVariant ?? 'off'
  // Vorgabe aus den Einstellungen; der Besucher überschreibt sie mit ?rueckschau=<Tage>
  const defaultPeriodDays = parsePeriodDays(settings.lagebildPeriodDays)
  const periodDays: PeriodDays = parsePeriodDays(requestedPeriod, defaultPeriodDays)
  // Zeitraum des Balkens: Vorgabe aus den Einstellungen, der Besucher überschreibt sie mit ?balken=<Stunden>
  const defaultBarHours = parseBarHours(settings.lagebildBarHours)
  const barHours: BarHours = parseBarHours(requestedBar, defaultBarHours)
  const loaded = lagebildVariant === 'off' ? null : await loadLagebildCached(lang, dt, periodDays, barHours, cacheMinutesSetting(settings))
  const lagebild = loaded?.data ?? null
  // Stand der Seite: Beginn der Berechnung des Lagebilds, ohne Lagebild der Aufruf. Banner, Dienste und Meldungen werden bei
  // jedem Aufruf frisch gelesen: gleich alt oder neuer, bis auf die Dauer des Aufrufs (Millisekunden bis wenige Sekunden).
  // Der Browser bekommt das Alter statt der Uhrzeit: Seine Uhr kann abweichen.
  const refresh = autoRefreshProps(settings, dt, loaded?.computedAt)

  // Boxen neben dem Lagebild: nur in den Varianten a, b und both
  let boxes = null
  if (lagebildVariant !== 'off') {
    const openIncidents = await payload.find({
      collection: 'incidents',
      where: { status: { not_equals: 'resolved' } },
      sort: '-createdAt',
      depth: 1,
      limit: 50,
    })
    // Box und Block „Aktuelle Störungen“ bauen auf derselben Liste auf: offen ist, wessen neuester Eintrag nicht „resolved“ ist
    const currentIncidents = openIncidents.docs.filter(isOpenIncident)
    // Die Box zeigt nur geplante und laufende Wartungen. Sie fragt selbst ab: Die Liste unten ist auf 10 begrenzt und enthält
    // auch gerade abgeschlossene Wartungen, damit würden bei vielen Wartungen spätere geplante fehlen und der Zähler wäre zu niedrig.
    const openMaintenances = await payload.find({
      collection: 'maintenances',
      where: { status: { in: ['upcoming', 'in_progress'] } },
      sort: 'scheduledStartAt',
      depth: 1,
      pagination: false,
    })
    boxes = {
      entries: parseBoxEntries(settings.statusBoxEntries),
      content: parseBoxContent(settings.statusBoxContent),
      placement: parseBoxesPlacement(settings.statusBoxesPlacement),
      incidentItems: buildIncidentItems(currentIncidents, dt, t),
      maintenanceItems: buildMaintenanceItems(openMaintenances.docs, dt, { t, tf }),
      currentIncidents: currentIncidents.map(formatIncident).map(forDisplay),
      pastResolvedIncidents,
    }
  }

  return {
    boxes,
    lagebildVariant,
    lagebild,
    refresh,
    defaultPeriodDays,
    defaultBarHours,
    settings,
    overallStatus,
    maintenanceBar,
    maintenanceNotices,
    serviceGroups: groupedServices,
    maintenances: formattedMaintenances,
    pastIncidents,
  }
}

export default async function StatusPage({
  searchParams,
}: {
  searchParams: Promise<{
    gruppe?: string | string[]
    rueckschau?: string | string[]
    balken?: string | string[]
  }>
}) {
  const { gruppe, rueckschau, balken } = await searchParams
  const {
    boxes,
    settings,
    overallStatus,
    maintenanceBar,
    maintenanceNotices,
    serviceGroups,
    maintenances,
    pastIncidents,
    lagebild,
    lagebildVariant,
    refresh,
    defaultPeriodDays,
    defaultBarHours,
  } = await getStatusData(rueckschau, balken)
  const { t, tf } = translatorsFor()
  const initialGroup = typeof gruppe === 'string' ? gruppe : null

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header
        siteName={settings.siteName}
        logoLightUrl={getMediaUrl(settings.logoLight)}
        logoDarkUrl={getMediaUrl(settings.logoDark)}
        refresh={refresh}
      >
        <LoginButton />
        <Subscribe />
      </Header>

      <main className={cn('mx-auto w-full flex-1 px-4 py-8 sm:px-6', boxes ? 'max-w-6xl' : 'max-w-4xl')}>
        {/* Status Banner */}
        <section className="mb-8 animate-fade-in">
          <StatusBanner status={overallStatus} message={settings.customStatusMessage ?? undefined} />
          {maintenanceBar && <MaintenanceBar text={maintenanceBar} outlined={overallStatus === 'maintenance'} />}
        </section>

        {boxes ? (
          <>
            {/* Lagebild links, Boxen rechts; unter lg vor oder nach dem Lagebild (Website-Einstellungen → Lagebild) */}
            <div
              data-testid="status-layout"
              data-variant={lagebildVariant}
              data-placement={boxes.placement}
              className="mb-10 grid gap-6 lg:grid-cols-[minmax(0,1.9fr)_minmax(18rem,1fr)] lg:items-start"
            >
              <div className="min-w-0">
                {lagebild && (
                  <Lagebild
                    variant={lagebildVariant as 'a' | 'b'}
                    data={lagebild}
                    maintenanceNotices={maintenanceNotices}
                    initialGroup={initialGroup}
                    defaultPeriodDays={defaultPeriodDays}
                    defaultBarHours={defaultBarHours}
                  />
                )}
              </div>
              <div className={boxes.placement === 'before' ? 'order-first lg:order-none' : 'order-last'}>
                <StatusBoxes
                  incidents={boxes.incidentItems}
                  maintenances={boxes.maintenanceItems}
                  entries={boxes.entries}
                  content={boxes.content}
                  t={t}
                  tf={tf}
                />
              </div>
            </div>

            {/* Aktuelle Störungen: alle offenen, mit Verlauf */}
            <section id="incidents" className="mb-10 animate-fade-in">
              <h2 className="mb-4 text-xl font-bold text-foreground">{t('home.currentIncidents')}</h2>
              {boxes.currentIncidents.length === 0 ? (
                <div className="rounded-lg border border-border bg-muted/30 px-5 py-4">
                  <p className="text-sm text-muted-foreground">{t('statusBoxes.noIncidents')}</p>
                </div>
              ) : (
                <IncidentTimelineWithLinks
                  days={[{ date: '', dateSlug: 'current', incidents: boxes.currentIncidents }]}
                />
              )}
            </section>
          </>
        ) : (
          <>
            {/* Service Groups */}
            <section className="mb-10 space-y-4">
              {serviceGroups.map((group, index) => {
                const allOperational = group.services.every((s) => s.status === 'operational')
                return (
                  <div
                    key={group.name}
                    className="animate-fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <ServiceGroup
                      name={group.name}
                      services={group.services}
                      defaultExpanded={!allOperational}
                    />
                  </div>
                )
              })}
            </section>

            {/* Status Legend */}
            <section className="mb-10">
              <StatusLegend />
            </section>
          </>
        )}

        {/* Scheduled Maintenance */}
        {maintenances.length > 0 && (
          <section id={boxes ? 'maintenance' : undefined} className="mb-10 animate-fade-in">
            <h2 className="mb-4 text-xl font-bold text-foreground">{t('home.scheduledMaintenance')}</h2>
            <div className="space-y-4">
              {maintenances.map((maintenance) => (
                <MaintenanceCard key={maintenance.id} maintenance={maintenance} />
              ))}
            </div>
          </section>
        )}

        {/* Past Incidents */}
        <section id={boxes ? 'past-incidents' : undefined} className="animate-fade-in">
          <h2 className="mb-6 text-xl font-bold text-foreground">{t('home.pastIncidents')}</h2>
          <IncidentTimelineWithLinks days={boxes ? boxes.pastResolvedIncidents : pastIncidents} />
          <div className="mt-6 text-center">
            <Link
              href="/history"
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {t('home.viewHistory')}
            </Link>
          </div>
        </section>
      </main>

      <Footer footerText={settings.footerText} timezone={settings.timezone} />
    </div>
  )
}
