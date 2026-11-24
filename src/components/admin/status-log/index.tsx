import React from 'react'
import type { AdminViewServerProps } from 'payload'
import { notFound } from 'next/navigation'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { normalizeRules } from '@/lib/incident-classification'
import { ta } from '@/lib/i18n/admin'
import { hasRole, type RoleUser } from '@/lib/roles'
import { safeLocale, safeTimeZone } from '@/lib/datetime'
import { translatorsFor } from '@/lib/i18n/translators'
import { isStatusLogMaintenanceDisabled } from '@/lib/status-log-maintenance'
import { StatusLogActions } from './StatusLogActions'
import './status-log.scss'

/** Admin-Ansicht unter `/admin/protokoll-pflege`. Ohne angemeldeten Nutzer bleibt sie leer, bei `DISABLE_STATUS_LOG_MAINTENANCE=true` zeigt sie nur einen Hinweis. */
export async function StatusLogAdminView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const user = initPageResult.req.user
  if (!user) return null
  // Nur Admin: Für andere Rollen gibt es die Seite nicht
  if (!hasRole(user as RoleUser, 'admin')) notFound()
  const disabled = isStatusLogMaintenanceDisabled()
  const settings = disabled ? null : await initPageResult.req.payload.findGlobal({ slug: 'settings' })
  const ruleCount = settings ? normalizeRules(settings.classificationRules).length : 0
  const timeZone = safeTimeZone(settings?.timezone || 'UTC')
  const locale = safeLocale(settings?.locale || translatorsFor('').dateLocale)
  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={initPageResult.req.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={user}
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter>
        {disabled ? (
          <div className="status-log">
            <h1>{ta('Maintain the status log')}</h1>
            <div className="status-log__notice" role="note" data-testid="status-log-disabled">
              <strong>{ta('This function is switched off on this installation.')}</strong>{' '}
              {ta(
                'The status log cannot be recalculated here and no maintenances can be converted. The reports read the log unchanged. An operator can switch the function on again by removing DISABLE_STATUS_LOG_MAINTENANCE and restarting the application.',
              )}
            </div>
          </div>
        ) : (
          <StatusLogActions ruleCount={ruleCount} timeZone={timeZone} locale={locale} />
        )}
      </Gutter>
    </DefaultTemplate>
  )
}
