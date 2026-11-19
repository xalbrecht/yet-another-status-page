'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useAdminText } from '@/lib/i18n/admin-client'
import { servicesPhrase, type DraftTexts, type ServiceNaming } from '@/lib/incident-draft'
import { fillMaintenanceTemplate, missingMaintenanceFields, startIsInPast, zonedLocalToUtc } from '@/lib/maintenance-draft'
import { formatScheduleValue, templateUses } from '@/lib/update-template'
import {
  GroupStep,
  ServicesStep,
  Step,
  TemplateStep,
  TextsStep,
  type TextTab,
  type WizardGroup,
  type WizardTemplate,
} from './IncidentWizardParts'
import { MaintenanceDone, MaintenancePreview, maintenanceMissingLabel, PeriodStep } from './MaintenanceWizardParts'
import './incident-wizard.scss'

const LIST_URL = '/admin/collections/maintenances'
// Ereignis-Handler rufen die Uhr über diese Funktion auf: Die Lint-Regel gegen `Date.now()` im Rendern sieht sie sonst als Aufruf beim Rendern
const currentTime = () => Date.now()
const EMPTY_TEXTS: DraftTexts = { title: '', body: '', smsBody: '', ntfyBody: '' }

type Done = { id: number; title: string; services: WizardGroup['services'] }

/**
 * Teil der Seite „Neu erstellen mit Vorlage“ für die Art „Wartung“: Gruppe, Dienste, Zeitraum, Vorlage, Texte, Vorschau.
 * Die Eingaben für Beginn und Ende gelten in der Zeitzone der Installation, nicht des Browsers. Die Ankündigung wird die erste
 * Aktualisierung der Wartung mit dem Status „Geplant“.
 */
export const MaintenanceWizard: React.FC<{ groups: WizardGroup[]; templates: WizardTemplate[]; locale: string; timeZone: string }> = ({ groups, templates, locale, timeZone }) => {
  const ta = useAdminText()
  const [view, setView] = useState<'edit' | 'preview' | 'done'>('edit')
  const [groupId, setGroupId] = useState('')
  const [serviceIds, setServiceIds] = useState<number[]>([])
  const [naming, setNaming] = useState<ServiceNaming>('list')
  // Keine Vorgabe: Die Art der Wartung wählt der Nutzer immer selbst
  const [maintenanceKind, setMaintenanceKind] = useState('')
  const [affectsService, setAffectsService] = useState(false)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  // Zeitpunkt der Eingabe, nicht des Rendern: `Date.now()` gehört in den Ereignis-Handler
  const [pastStart, setPastStart] = useState(false)
  const [templateChoice, setTemplateChoice] = useState<string | null>(null)
  const [texts, setTexts] = useState<DraftTexts>(EMPTY_TEXTS)
  const [tab, setTab] = useState<TextTab>('page')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Done | null>(null)

  const group = groups.find((candidate) => String(candidate.id) === groupId) ?? null
  const selected = useMemo(() => (group ? group.services.filter((service) => serviceIds.includes(service.id)) : []), [group, serviceIds])
  const template = templates.find((candidate) => String(candidate.id) === templateChoice) ?? null
  const groupPhrase = (name: string) => ta('all services of the group {group}').replace('{group}', name)

  const startUtc = zonedLocalToUtc(start, timeZone)
  const endGiven = end !== ''
  const endUtc = endGiven ? zonedLocalToUtc(end, timeZone) : null
  const startLabel = startUtc ? formatScheduleValue(startUtc, locale, timeZone) : ''
  const endLabel = endUtc ? formatScheduleValue(endUtc, locale, timeZone) : ''
  const endBeforeStart = Boolean(startUtc && endGiven && (!endUtc || new Date(endUtc).getTime() < new Date(startUtc).getTime()))
  const templateNeedsEnd = Boolean(template && !endGiven && templateUses({ ...template, status: 'upcoming' }, 'end'))

  const phrase = (ids: number[], mode: ServiceNaming) =>
    group
      ? servicesPhrase({
          selectedNames: group.services.filter((service) => ids.includes(service.id)).map((service) => service.name),
          groupServiceCount: group.services.length,
          groupName: group.name,
          naming: mode,
          locale,
          groupPhrase,
        })
      : ''
  const listText = group ? phrase(group.services.map((service) => service.id), 'list') : ''

  /** Füllt die Texte neu aus der Vorlage. Ein Wert, der noch fehlt, bleibt leer (Beginn und Ende stehen erst nach der Eingabe fest). */
  function refill(next: { ids: number[]; mode: ServiceNaming; chosen: WizardTemplate | null; startLabel: string; endLabel: string }) {
    if (!next.chosen || !group) return
    setTexts(
      fillMaintenanceTemplate(next.chosen, {
        services: phrase(next.ids, next.mode),
        group: group.name,
        start: next.startLabel,
        end: next.endLabel,
      }),
    )
  }
  const current = { ids: serviceIds, mode: naming, chosen: template, startLabel, endLabel }

  function selectGroup(id: string) {
    setGroupId(id)
    setServiceIds([])
    setNaming('list')
    setTemplateChoice(null)
    setTexts(EMPTY_TEXTS)
  }

  function changeServices(ids: number[]) {
    setServiceIds(ids)
    const mode = group && ids.length === group.services.length ? naming : 'list'
    if (mode !== naming) setNaming(mode)
    if (ids.length === 0) {
      setTemplateChoice(null)
      setTexts(EMPTY_TEXTS)
      return
    }
    refill({ ...current, ids, mode })
  }

  function changeStart(value: string) {
    setStart(value)
    const utc = zonedLocalToUtc(value, timeZone)
    setPastStart(startIsInPast(utc, currentTime()))
    refill({ ...current, startLabel: utc ? formatScheduleValue(utc, locale, timeZone) : '' })
  }

  function changeEnd(value: string) {
    setEnd(value)
    const utc = value ? zonedLocalToUtc(value, timeZone) : null
    refill({ ...current, endLabel: utc ? formatScheduleValue(utc, locale, timeZone) : '' })
  }

  function chooseTemplate(choice: string) {
    const chosen = templates.find((candidate) => String(candidate.id) === choice) ?? null
    setTemplateChoice(choice)
    if (chosen) refill({ ...current, chosen })
    else setTexts(EMPTY_TEXTS)
  }

  const missing = missingMaintenanceFields({ maintenanceKind: maintenanceKind || null, groupId, serviceIds: serviceIds.map(String), startUtc, endUtc, endGiven, templateChoice, texts })
  const missingText = missing.map((field) => maintenanceMissingLabel(field, ta)).join(', ')

  function go(next: 'edit' | 'preview' | 'done') {
    setView(next)
    window.scrollTo(0, 0)
  }

  async function publish() {
    if (!startUtc) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/maintenances/from-template', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: texts.title,
          message: texts.body,
          maintenanceKind,
          ...(affectsService ? { affectsService: true } : {}),
          serviceIds,
          start: startUtc,
          ...(endUtc ? { end: endUtc } : {}),
          ...(texts.smsBody.trim() ? { smsBody: texts.smsBody } : {}),
          ...(texts.ntfyBody.trim() ? { ntfyBody: texts.ntfyBody } : {}),
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`)
      setDone({ id: body.id, title: texts.title, services: selected })
      go('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : ta('Unknown error'))
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    selectGroup('')
    setMaintenanceKind('')
    setStart('')
    setEnd('')
    setPastStart(false)
    setError(null)
    setDone(null)
    setTab('page')
    go('edit')
  }

  if (view === 'done' && done) {
    return (
      <div className="iw">
        <MaintenanceDone
          title={done.title}
          services={done.services}
          maintenanceUrl={`${LIST_URL}/${done.id}`}
          draftsUrl={`/admin/collections/notifications?where[relatedMaintenance][equals]=${done.id}`}
          listUrl={LIST_URL}
          onAgain={reset}
        />
      </div>
    )
  }

  if (view === 'preview' && startUtc) {
    return (
      <div className="iw">
        <MaintenancePreview texts={texts} services={selected} startLabel={startLabel} endLabel={endLabel} startInPast={pastStart} onBack={() => go('edit')} onPublish={publish} busy={busy} error={error} />
      </div>
    )
  }

  const hasGroup = group !== null
  const hasServices = serviceIds.length > 0
  const hasPeriod = startUtc !== null && !endBeforeStart && maintenanceKind !== ''
  const hasTemplate = templateChoice !== null
  return (
    <div className="iw" data-testid="wizard-maintenance">
      <h1>{ta('Report a maintenance with a template')}</h1>
      <p className="iw-lead">{ta('Choose group, services, period and template. Title and text come from the template and stay editable. Before anything is published, a preview shows what happens.')}</p>

      <Step number={1} title={ta('Group')} summary={group?.name} done={hasGroup}>
        <GroupStep groups={groups} groupId={groupId} onSelect={selectGroup} />
        {groups.length === 0 && <p className="iw-hint">{ta('There are no service groups with services yet.')}</p>}
      </Step>

      <Step number={2} title={ta('Affected services')} summary={hasServices && group ? ta('{count} of {total} selected').replace('{count}', String(serviceIds.length)).replace('{total}', String(group.services.length)) : undefined} done={hasServices} locked={!hasGroup}>
        {group ? (
          <ServicesStep
            group={group}
            serviceIds={serviceIds}
            naming={naming}
            onToggle={(id, on) => changeServices(on ? [...serviceIds, id] : serviceIds.filter((candidate) => candidate !== id))}
            onToggleAll={(on) => changeServices(on ? group.services.map((service) => service.id) : [])}
            onNaming={(mode) => {
              setNaming(mode)
              refill({ ...current, mode })
            }}
            listText={listText}
          />
        ) : (
          <p className="iw-hint">{ta('Choose the group first.')}</p>
        )}
      </Step>

      <Step number={3} title={ta('Period')} summary={startLabel ? `${startLabel}${endLabel ? ` – ${endLabel}` : ''}` : undefined} done={hasPeriod} locked={!hasServices}>
        {hasServices ? (
          <PeriodStep timeZone={timeZone} maintenanceKind={maintenanceKind} onMaintenanceKind={setMaintenanceKind} affectsService={affectsService} onAffectsService={setAffectsService} start={start} end={end} onStart={changeStart} onEnd={changeEnd} startInPast={pastStart} endBeforeStart={endBeforeStart} templateNeedsEnd={templateNeedsEnd} />
        ) : (
          <p className="iw-hint">{ta('Choose the services first.')}</p>
        )}
      </Step>

      <Step number={4} title={ta('Template')} summary={hasTemplate ? (template ? template.name : ta('Without a template')) : undefined} done={hasTemplate} locked={!hasPeriod}>
        {hasPeriod ? <TemplateStep templates={templates} choice={templateChoice} onChoose={chooseTemplate} kind="maintenance" /> : <p className="iw-hint">{ta('Enter the period first.')}</p>}
      </Step>

      <Step number={5} title={ta('Check and adjust')} locked={!hasTemplate}>
        {hasTemplate ? <TextsStep texts={texts} tab={tab} onTab={setTab} onChange={(key, value) => setTexts((previous) => ({ ...previous, [key]: value }))} /> : <p className="iw-hint">{ta('Title and texts appear here with the placeholders filled in.')}</p>}
      </Step>

      <div className="iw-actions">
        <button type="button" className="iw-btn iw-btn--primary" data-testid="preview-button" disabled={missing.length > 0} onClick={() => go('preview')}>{ta('View preview')}</button>
        <Link className="iw-btn" href={LIST_URL}>{ta('Cancel')}</Link>
        {missing.length > 0 && <span className="iw-missing" data-testid="missing">{ta('Still needed: {fields}').replace('{fields}', missingText)}</span>}
      </div>
    </div>
  )
}
