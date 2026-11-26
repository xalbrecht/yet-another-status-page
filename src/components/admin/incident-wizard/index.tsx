import React from 'react'
import type { AdminViewServerProps } from 'payload'
import { notFound } from 'next/navigation'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { safeLocale, safeTimeZone } from '@/lib/datetime'
import { translatorsFor } from '@/lib/i18n/translators'
import { TemplateWizard } from './TemplateWizard'
import { activeServiceWhereNow } from '@/lib/service-lifecycle'
import type { RoleUser } from '@/lib/roles'
import { wizardAccess, wizardKind } from '@/lib/wizard-access'
import type { WizardGroup, WizardTemplate, ServiceState } from './IncidentWizardParts'

const idOf = (value: unknown): number => Number(typeof value === 'object' && value !== null ? (value as { id: unknown }).id : value)

/**
 * Admin-Ansicht unter `/admin/incident-from-template` („Neu erstellen mit Vorlage“ in der Liste der Störungen und der Wartungen).
 * Lädt Gruppen mit ihren Diensten, die Vorlagen für eine neue Störung und merkt sich, welche Dienste schon eine offene Störung haben.
 * Der Produktmanager legt nur Wartungen an: Für ihn öffnet die Seite immer mit der Art „Wartung“, die Art „Störung“ gibt es nicht.
 * Ohne angemeldeten Nutzer bleibt sie leer.
 */
export async function IncidentFromTemplateView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const user = initPageResult.req.user
  if (!user) return null
  // Admin und ServiceDesk legen Störungen und Wartungen an, der Produktmanager nur Wartungen, alle anderen Rollen nichts
  const access = wizardAccess(user as RoleUser)
  if (access.kinds.length === 0) notFound()
  const payload = initPageResult.req.payload
  // ServiceDesk und Produktmanager wählen nur Dienste und Gruppen ihres Bereichs, der Server prüft es beim Speichern ebenfalls.
  // Je Art gilt ein eigener Bereich (ein Konto mit beiden Rollen legt Störungen nur im Bereich des ServiceDesk an).
  const { incidentScope, maintenanceScope } = access
  const loadAll = incidentScope === 'all' || maintenanceScope === 'all'
  const inScope = loadAll
    ? undefined
    : [...new Set([...(access.kinds.includes('incident') ? incidentScope : []), ...maintenanceScope])]
  const inScopeIds = inScope ? (inScope.length ? inScope : [0]) : undefined

  const [groupsResult, servicesResult, templatesResult, maintenanceTemplatesResult, openIncidents, settings] = await Promise.all([
    payload.find({ collection: 'service-groups', where: inScopeIds ? { id: { in: inScopeIds } } : undefined, sort: '_order', pagination: false, depth: 0 }),
    payload.find({ collection: 'services', where: inScopeIds ? { and: [activeServiceWhereNow(), { group: { in: inScopeIds } }] } : activeServiceWhereNow(), sort: '_order', pagination: false, depth: 0 }),
    payload.find({
      collection: 'message-templates',
      where: { and: [{ kind: { equals: 'incident' } }, { status: { equals: 'investigating' } }] },
      sort: 'name',
      pagination: false,
      depth: 0,
    }),
    payload.find({
      collection: 'message-templates',
      where: { and: [{ kind: { equals: 'maintenance' } }, { status: { equals: 'upcoming' } }] },
      sort: 'name',
      pagination: false,
      depth: 0,
    }),
    payload.find({ collection: 'incidents', where: { status: { not_equals: 'resolved' } }, pagination: false, depth: 0 }),
    payload.findGlobal({ slug: 'settings' }),
  ])

  const withOpenIncident = new Set<number>()
  for (const incident of openIncidents.docs) {
    for (const service of incident.affectedServices ?? []) withOpenIncident.add(idOf(service))
  }

  // Gruppen mit ihren Diensten, begrenzt auf den Bereich der Art (`all` = keine Grenze)
  const groupsFor = (scope: 'all' | number[]): WizardGroup[] =>
    groupsResult.docs
      .filter((group) => scope === 'all' || scope.includes(Number(group.id)))
      .map((group) => ({
        id: Number(group.id),
        name: group.name,
        services: servicesResult.docs
          .filter((service) => idOf(service.group) === Number(group.id))
          .map((service) => ({
            id: Number(service.id),
            name: service.name,
            status: (service.status ?? 'operational') as ServiceState,
            openIncident: withOpenIncident.has(Number(service.id)),
          })),
      }))
      .filter((group) => group.services.length > 0)
  const groups = access.kinds.includes('incident') ? groupsFor(incidentScope) : []
  const maintenanceGroups = groupsFor(maintenanceScope)

  const toWizardTemplate = (template: (typeof templatesResult.docs)[number]): WizardTemplate => ({
    id: Number(template.id),
    name: template.name,
    impact: template.impact ?? null,
    title: template.title,
    body: template.body,
    smsBody: template.smsBody ?? null,
    ntfyBody: template.ntfyBody ?? null,
  })
  const incidentTemplates = templatesResult.docs.map(toWizardTemplate)
  const maintenanceTemplates = maintenanceTemplatesResult.docs.map(toWizardTemplate)

  // Sprache der Aufzählung: die eingestellte Locale, sonst die Datumssprache der Oberfläche
  const locale = safeLocale(settings.locale || translatorsFor('').dateLocale)
  const timeZone = safeTimeZone(settings.timezone || 'UTC')
  // Der Knopf in der Liste der Wartungen wählt die Art vor (`?kind=maintenance`)
  // Ohne Recht auf Störungen öffnet die Seite auch bei `?kind=incident` mit der Art „Wartung“
  const initialKind = wizardKind(searchParams?.kind === 'maintenance' ? 'maintenance' : 'incident', access.kinds)

  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={user}
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter>
        <TemplateWizard kinds={access.kinds} groups={groups} maintenanceGroups={maintenanceGroups} incidentTemplates={incidentTemplates} maintenanceTemplates={maintenanceTemplates} locale={locale} timeZone={timeZone} initialKind={initialKind} />
      </Gutter>
    </DefaultTemplate>
  )
}
