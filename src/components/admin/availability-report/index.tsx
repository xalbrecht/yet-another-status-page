import React from 'react'
import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { loadReport } from '@/lib/report/load'
import { periodOptions } from '@/lib/report/period'
import { resolveDateTimeConfig } from '@/lib/datetime'
import { parseReportParams } from '@/lib/report/params'
import { ReportControls } from './ReportControls'
import { ReportView } from './ReportView'
import './report.scss'

/** Die Ansicht wird bei jedem Aufruf auf dem Server gerendert, die aktuelle Zeit ist Teil der Eingabe. */
const currentTime = () => Date.now()

/** Admin-Ansicht unter `/admin/verfuegbarkeitsbericht`. Ohne angemeldeten Nutzer leitet Payload zur Anmeldung. */
export async function AvailabilityReportView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req } = initPageResult
  if (!req.user) redirect('/admin/login')
  const search = (searchParams ?? {}) as Record<string, string | string[] | undefined>
  const now = currentTime()
  const settings = await req.payload.findGlobal({ slug: 'settings' })
  const dt = resolveDateTimeConfig(settings)
  const result = await loadReport(req.payload, search, now)
  const reportParams = parseReportParams(search)
  const options = periodOptions(now, dt.timezone, dt.locale)
  const periodKey = result.ok ? result.period.key : reportParams.period ?? options[1]?.value ?? 'custom'

  const controls = <ReportControls params={reportParams} periodKey={periodKey} periodOptions={options} />

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={req.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={req.user}
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter>
        {result.ok ? (
          <ReportView data={result.data} params={result.params} period={result.period} locale={dt.locale} controls={controls} />
        ) : (
          <div className="availability-report">
            <h1>Verfügbarkeitsbericht</h1>
            {controls}
            <p role="alert" className="availability-report__error">{result.error}</p>
          </div>
        )}
      </Gutter>
    </DefaultTemplate>
  )
}
