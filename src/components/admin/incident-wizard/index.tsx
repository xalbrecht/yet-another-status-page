import React from 'react'
import type { AdminViewServerProps } from 'payload'
import { notFound } from 'next/navigation'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { safeLocale, safeTimeZone } from '@/lib/datetime'
import { translatorsFor } from '@/lib/i18n/translators'
import { TemplateWizard, type MessageKind } from './TemplateWizard'
import { activeServiceWhereNow } from '@/lib/service-lifecycle'
import { groupScope, hasAnyRole, type RoleUser } from '@/lib/roles'
import type { WizardGroup, WizardTemplate, ServiceState } from './IncidentWizardParts'

const idOf = (value: unknown): number => Number(typeof value === 'object' && value !== null ? (value as { id: unknown }).id : value)

/**
 * Admin-Ansicht unter `/admin/incident-from-template` („Neu erstellen mit Vorlage“ in der Liste der Störungen).
 * Lädt Gruppen mit ihren Diensten, die Vorlagen für eine neue Störung und merkt sich, welche Dienste schon eine offene Störung haben.
 * Ohne angemeldeten Nutzer bleibt sie leer.
 */
export async function IncidentFromTemplateView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const user = initPageResult.req.user
  if (!user) return null
  // Nur Admin und ServiceDesk: Für andere Rollen gibt es die Seite nicht
  if (!hasAnyRole(user as RoleUser, ['admin', 'servicedesk'])) notFound()
  const payload = initPageResult.req.payload
  // ServiceDesk wählt nur Dienste und Gruppen seines Bereichs, der Server prüft es beim Speichern ebenfalls
  const scope = groupScope(user as RoleUser, ['servicedesk'])
  const inScope = scope === 'all' ? undefined : scope.length ? scope : [0]

  const [groupsResult, servicesResult, templatesResult, maintenanceTemplatesResult, openIncidents, settings] = await Promise.all([
    payload.find({ collection: 'service-groups', where: inScope ? { id: { in: inScope } } : undefined, sort: '_order', pagination: false, depth: 0 }),
    payload.find({ collection: 'services', where: inScope ? { and: [activeServiceWhereNow(), { group: { in: inScope } }] } : activeServiceWhereNow(), sort: '_order', pagination: false, depth: 0 }),
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

  const groups: WizardGroup[] = groupsResult.docs
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
  const initialKind: MessageKind = searchParams?.kind === 'maintenance' ? 'maintenance' : 'incident'

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
        <TemplateWizard groups={groups} incidentTemplates={incidentTemplates} maintenanceTemplates={maintenanceTemplates} locale={locale} timeZone={timeZone} initialKind={initialKind} />
      </Gutter>
    </DefaultTemplate>
  )
}
