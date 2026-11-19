'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useAdminText } from '@/lib/i18n/admin-client'
import { fillTemplate, missingFields, servicesPhrase, type DraftTexts, type Impact, type ServiceNaming } from '@/lib/incident-draft'
import { placeholdersIn } from '@/lib/template-text'
import {
  DoneView,
  GroupStep,
  ImpactStep,
  impactLabel,
  missingLabel,
  PreviewView,
  ServicesStep,
  Step,
  TemplateStep,
  TextsStep,
  type TextTab,
  type WizardGroup,
  type WizardService,
  type WizardTemplate,
} from './IncidentWizardParts'
import './incident-wizard.scss'

const LIST_URL = '/admin/collections/incidents'
const EMPTY_TEXTS: DraftTexts = { title: '', body: '', smsBody: '', ntfyBody: '' }

type Done = { id: number; title: string; impact: Impact; services: WizardService[]; createDraft: boolean }

/** Seite „Neu erstellen mit Vorlage“: Gruppe, Dienste, Vorlage, Auswirkung, Prüfen, Vorschau mit Bestätigung. Legt die Störung erst nach der Bestätigung an. */
export const IncidentWizard: React.FC<{ groups: WizardGroup[]; templates: WizardTemplate[]; locale: string }> = ({ groups, templates, locale }) => {
  const ta = useAdminText()
  const [view, setView] = useState<'edit' | 'preview' | 'done'>('edit')
  const [groupId, setGroupId] = useState('')
  const [serviceIds, setServiceIds] = useState<number[]>([])
  const [naming, setNaming] = useState<ServiceNaming>('list')
  const [templateChoice, setTemplateChoice] = useState<string | null>(null)
  const [impact, setImpact] = useState<Impact | null>(null)
  const [texts, setTexts] = useState<DraftTexts>(EMPTY_TEXTS)
  const [tab, setTab] = useState<TextTab>('page')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Done | null>(null)
  const [createDraft, setCreateDraft] = useState(true)

  const group = groups.find((candidate) => String(candidate.id) === groupId) ?? null
  const selected = useMemo(() => (group ? group.services.filter((service) => serviceIds.includes(service.id)) : []), [group, serviceIds])
  const template = templates.find((candidate) => String(candidate.id) === templateChoice) ?? null
  const groupPhrase = (name: string) => ta('all services of the group {group}').replace('{group}', name)

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

  /** Füllt die Texte neu aus der Vorlage. Ohne Auswirkung bleibt `{{impact}}` stehen und wird bei der Wahl der Auswirkung ersetzt. */
  function refill(next: { ids: number[]; mode: ServiceNaming; chosen: WizardTemplate | null; impact: Impact | null }) {
    if (!next.chosen || !group) return
    setTexts(
      fillTemplate(next.chosen, {
        services: phrase(next.ids, next.mode),
        group: group.name,
        impact: next.impact ? impactLabel(next.impact, ta) : '{{impact}}',
      }),
    )
  }

  function selectGroup(id: string) {
    setGroupId(id)
    setServiceIds([])
    setNaming('list')
    setTemplateChoice(null)
    setImpact(null)
    setTexts(EMPTY_TEXTS)
  }

  function changeServices(ids: number[]) {
    setServiceIds(ids)
    const mode = group && ids.length === group.services.length ? naming : 'list'
    if (mode !== naming) setNaming(mode)
    if (ids.length === 0) {
      setTemplateChoice(null)
      setImpact(null)
      setTexts(EMPTY_TEXTS)
      return
    }
    refill({ ids, mode, chosen: template, impact })
  }

  function chooseTemplate(choice: string) {
    const chosen = templates.find((candidate) => String(candidate.id) === choice) ?? null
    setTemplateChoice(choice)
    setImpact(chosen?.impact ?? null)
    if (chosen) refill({ ids: serviceIds, mode: naming, chosen, impact: chosen.impact })
    else setTexts(EMPTY_TEXTS)
  }

  function chooseImpact(next: Impact) {
    setImpact(next)
    // Die Vorlage ersetzt `{{impact}}` erst, wenn die Auswirkung feststeht: nur dann die Texte neu füllen
    const usesImpact = template && [template.title, template.body, template.smsBody, template.ntfyBody].some((text) => placeholdersIn(text ?? '').includes('impact'))
    if (template && usesImpact) refill({ ids: serviceIds, mode: naming, chosen: template, impact: next })
  }

  const missing = missingFields({ groupId, serviceIds: serviceIds.map(String), templateChoice, impact, texts })
  const missingText = missing.map((field) => missingLabel(field, ta)).join(', ')

  function go(next: 'edit' | 'preview' | 'done') {
    setView(next)
    window.scrollTo(0, 0)
  }

  async function publish() {
    if (!impact) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/incidents/from-template', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: texts.title,
          message: texts.body,
          impact,
          ...(createDraft ? {} : { createNotificationDraft: false }),
          serviceIds,
          ...(texts.smsBody.trim() ? { smsBody: texts.smsBody } : {}),
          ...(texts.ntfyBody.trim() ? { ntfyBody: texts.ntfyBody } : {}),
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`)
      setDone({ id: body.id, title: texts.title, impact, services: selected, createDraft })
      go('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : ta('Unknown error'))
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    selectGroup('')
    setCreateDraft(true)
    setError(null)
    setDone(null)
    setTab('page')
    go('edit')
  }

  if (view === 'done' && done) {
    return (
      <div className="iw">
        <DoneView
          title={done.title}
          impact={done.impact}
          services={done.services}
          incidentUrl={`${LIST_URL}/${done.id}`}
          createDraft={done.createDraft}
          draftsUrl={`/admin/collections/notifications?where[relatedIncident][equals]=${done.id}`}
          listUrl={LIST_URL}
          onAgain={reset}
        />
      </div>
    )
  }

  if (view === 'preview' && impact) {
    return (
      <div className="iw">
        <div className="iw-crumb">
          <Link href="/admin">{ta('Dashboard')}</Link> / <Link href={LIST_URL}>{ta('Incidents')}</Link> / {ta('New with template')} / {ta('Preview')}
        </div>
        <PreviewView texts={texts} impact={impact} services={selected} createDraft={createDraft} onCreateDraft={setCreateDraft} onBack={() => go('edit')} onPublish={publish} busy={busy} error={error} />
      </div>
    )
  }

  const hasGroup = group !== null
  const hasServices = serviceIds.length > 0
  const hasTemplate = templateChoice !== null
  return (
    <div className="iw" data-testid="wizard">
      <div className="iw-crumb">
        <Link href="/admin">{ta('Dashboard')}</Link> / <Link href={LIST_URL}>{ta('Incidents')}</Link> / {ta('New with template')}
      </div>
      <h1>{ta('Report an incident with a template')}</h1>
      <p className="iw-lead">{ta('Choose group, services, template and impact. Title and text come from the template and stay editable. Before anything is published, a preview shows what happens.')}</p>

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
              refill({ ids: serviceIds, mode, chosen: template, impact })
            }}
            listText={listText}
          />
        ) : (
          <p className="iw-hint">{ta('Choose the group first.')}</p>
        )}
      </Step>

      <Step number={3} title={ta('Template')} summary={hasTemplate ? (template ? template.name : ta('Without a template')) : undefined} done={hasTemplate} locked={!hasServices}>
        {hasServices ? <TemplateStep templates={templates} choice={templateChoice} onChoose={chooseTemplate} /> : <p className="iw-hint">{ta('Choose the services first.')}</p>}
      </Step>

      <Step number={4} title={ta('Impact')} summary={impact ? impactLabel(impact, ta) : undefined} done={impact !== null} locked={!hasTemplate}>
        {hasTemplate ? <ImpactStep impact={impact} presetFromTemplate={template?.impact != null} onChoose={chooseImpact} /> : <p className="iw-hint">{ta('Choose a template first (or "Without a template").')}</p>}
      </Step>

      <Step number={5} title={ta('Check and adjust')} locked={!hasTemplate || impact === null}>
        {hasTemplate && impact !== null ? <TextsStep texts={texts} tab={tab} onTab={setTab} onChange={(key, value) => setTexts((current) => ({ ...current, [key]: value }))} /> : <p className="iw-hint">{ta('Title and texts appear here with the placeholders filled in.')}</p>}
      </Step>

      <div className="iw-actions">
        <button type="button" className="iw-btn iw-btn--primary" data-testid="preview-button" disabled={missing.length > 0} onClick={() => go('preview')}>{ta('View preview')}</button>
        <Link className="iw-btn" href={LIST_URL}>{ta('Cancel')}</Link>
        {missing.length > 0 && <span className="iw-missing" data-testid="missing">{ta('Still needed: {fields}').replace('{fields}', missingText)}</span>}
      </div>
    </div>
  )
}
