import React from 'react'
import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { loadReport } from '@/lib/report/load'
import { periodOptions } from '@/lib/report/period'
import { resolveDateTimeConfig } from '@/lib/datetime'
import { ta } from '@/lib/i18n/admin'
import { parseRecipients } from '@/lib/report/export/recipients'
import { parseReportParams, reportHref, reportTabHrefs, selectionQuery } from '@/lib/report/params'
import { ExportButtons } from './ExportButtons'
import { GroupList } from './GroupList'
import { GroupSheet } from './GroupSheet'
import { ReportControls } from './ReportControls'
import { ReportView } from './ReportView'
import { SendReportButton } from './SendReportButton'
import { ViewTabs } from './ViewTabs'
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
  // Empfänger des Berichts: nur angemeldete Nutzer erreichen diese Seite, die lokale API liest das Feld ohne Feldrechte
  const emailSettings = await req.payload.findGlobal({ slug: 'email-settings' })
  const recipients = parseRecipients(emailSettings.reportRecipients)
  const requested = parseReportParams(search)
  // Der Gesamtbericht zeigt immer alle Gruppen: eine Gruppe in der Adresse gilt nur für die Gruppenberichte
  const result = await loadReport(req.payload, requested.view === 'overall' ? { ...search, group: undefined } : search, now)
  // Bei ungültiger Gruppe (z. B. gelöscht, altes Lesezeichen) gilt keine Gruppe mehr: Formular und Tabs tragen sie nicht weiter
  const groupInvalid = result.ok && Boolean(result.data.error) && Boolean(requested.group)
  const reportParams = { ...(result.ok ? result.params : requested), ...(groupInvalid ? { group: undefined } : {}) }
  const options = periodOptions(now, dt.timezone, dt.locale)
  const periodKey = result.ok ? result.period.key : requested.period ?? options[1]?.value ?? 'custom'

  const controls = <ReportControls params={reportParams} periodKey={periodKey} periodOptions={options} />
  const exportable = result.ok && !result.data.error
  const tabs = (
    <>
      {exportable && <SendReportButton recipients={recipients} query={selectionQuery(search)} />}
      {exportable && <ExportButtons search={search} groupId={requested.view === 'groups' ? result.data.scope.groupId : null} />}
      <ViewTabs active={requested.view} hrefs={reportTabHrefs(search, groupInvalid)} />
    </>
  )

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
          <ReportView data={result.data} params={result.params} period={result.period} locale={dt.locale} controls={controls} tabs={tabs}>
            {requested.view === 'groups' &&
              (result.data.groupList.length === 0 ? (
                <p className="availability-report__muted">{ta('No groups with services.', 'Keine Gruppen mit Diensten.')}</p>
              ) : (
                <div className="availability-report__layout">
                  <GroupList
                    groups={result.data.groupList}
                    selectedId={result.data.scope.groupId}
                    hrefFor={(id) => reportHref(search, { view: 'groups', group: String(id) })}
                    locale={dt.locale}
                  />
                  <div className="availability-report__layout-main">
                    <GroupSheet data={result.data} locale={dt.locale} />
                  </div>
                </div>
              ))}
          </ReportView>
        ) : (
          <div className="availability-report">
            <h1>Verfügbarkeitsbericht</h1>
            {controls}
            {tabs}
            <p role="alert" className="availability-report__error">{result.error}</p>
          </div>
        )}
      </Gutter>
    </DefaultTemplate>
  )
}
