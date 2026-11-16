import React from 'react'
import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { normalizeRules } from '@/lib/incident-classification'
import { StatusLogActions } from './StatusLogActions'
import './status-log.scss'

/** Admin-Ansicht unter `/admin/protokoll-pflege`. Ohne angemeldeten Nutzer bleibt sie leer. */
export async function StatusLogAdminView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const user = initPageResult.req.user
  if (!user) return null
  const settings = await initPageResult.req.payload.findGlobal({ slug: 'settings' })
  const ruleCount = normalizeRules(settings.classificationRules).length
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
        <StatusLogActions ruleCount={ruleCount} />
      </Gutter>
    </DefaultTemplate>
  )
}
