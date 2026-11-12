import React from 'react'
import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { StatusLogActions } from './StatusLogActions'
import './status-log.scss'

/** Admin-Ansicht unter `/admin/protokoll-pflege`. Ohne angemeldeten Nutzer bleibt sie leer. */
export function StatusLogAdminView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const user = initPageResult.req.user
  if (!user) return null
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
        <StatusLogActions />
      </Gutter>
    </DefaultTemplate>
  )
}
