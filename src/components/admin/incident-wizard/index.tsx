import React from 'react'
import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { safeLocale } from '@/lib/datetime'
import { translatorsFor } from '@/lib/i18n/translators'
import { IncidentWizard } from './IncidentWizard'
import { activeServiceWhereNow } from '@/lib/service-lifecycle'
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
  const payload = initPageResult.req.payload

  const [groupsResult, servicesResult, templatesResult, openIncidents, settings] = await Promise.all([
    payload.find({ collection: 'service-groups', sort: '_order', pagination: false, depth: 0 }),
    payload.find({ collection: 'services', where: activeServiceWhereNow(), sort: '_order', pagination: false, depth: 0 }),
    payload.find({
      collection: 'message-templates',
      where: { and: [{ kind: { equals: 'incident' } }, { status: { equals: 'investigating' } }] },
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

  const templates: WizardTemplate[] = templatesResult.docs.map((template) => ({
    id: Number(template.id),
    name: template.name,
    impact: template.impact ?? null,
    title: template.title,
    body: template.body,
    smsBody: template.smsBody ?? null,
    ntfyBody: template.ntfyBody ?? null,
  }))

  // Sprache der Aufzählung: die eingestellte Locale, sonst die Datumssprache der Oberfläche
  const locale = safeLocale(settings.locale || translatorsFor('').dateLocale)

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
        <IncidentWizard groups={groups} templates={templates} locale={locale} />
      </Gutter>
    </DefaultTemplate>
  )
}
