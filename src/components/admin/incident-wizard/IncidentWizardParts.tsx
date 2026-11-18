import React from 'react'
import { useAdminText, type AdminText } from '@/lib/i18n/admin-client'
import { IMPACTS, type DraftTexts, type Impact, type MissingField, type ServiceNaming } from '@/lib/incident-draft'
import { NTFY_TEXT_MAX_LENGTH, SMS_TEXT_MAX_LENGTH } from '@/lib/template-text'

/**
 * Teile der Seite „Neu erstellen mit Vorlage“. Reine Komponenten ohne Zustand und ohne Stil-Import: Daten und Funktionen kommen von
 * `IncidentWizard.tsx`, so lassen sich die Teile ohne Browser prüfen.
 */
export type ServiceState = 'operational' | 'degraded' | 'partial' | 'major' | 'maintenance'
export type WizardService = { id: number; name: string; status: ServiceState; openIncident: boolean }
export type WizardGroup = { id: number; name: string; services: WizardService[] }
export type WizardTemplate = { id: number; name: string; impact: Impact | null; title: string; body: string; smsBody: string | null; ntfyBody: string | null }

export const stateLabel = (state: string, ta: AdminText): string => {
  switch (state) {
    case 'degraded':
      return ta('Degraded Performance')
    case 'partial':
      return ta('Partial Outage')
    case 'major':
      return ta('Major Outage')
    case 'maintenance':
      return ta('Under Maintenance')
    default:
      return ta('Operational')
  }
}

export const impactLabel = (impact: Impact, ta: AdminText): string => stateLabel(impact, ta)

const Dot = ({ state }: { state: string }) => <span className={`iw-dot iw-dot--${state}`} aria-hidden="true" />

export function Step({ number, title, summary, done, locked, children }: { number: number; title: string; summary?: string; done?: boolean; locked?: boolean; children: React.ReactNode }) {
  return (
    <section className={`iw-step${done ? ' iw-step--done' : ''}${locked ? ' iw-step--locked' : ''}`} data-testid={`step-${number}`}>
      <header>
        <span className="iw-num">{number}</span>
        <h2>{title}</h2>
        <span className="iw-sum">{summary}</span>
      </header>
      <div className="iw-body">{children}</div>
    </section>
  )
}

export function GroupStep({ groups, groupId, onSelect }: { groups: WizardGroup[]; groupId: string; onSelect: (id: string) => void }) {
  const ta = useAdminText()
  return (
    <>
      <label className="iw-label" htmlFor="iw-group">{ta('Choose a service group')}</label>
      <select id="iw-group" data-testid="group" value={groupId} onChange={(event) => onSelect(event.target.value)}>
        <option value="">{ta('– please choose –')}</option>
        {groups.map((group) => (
          <option key={group.id} value={String(group.id)}>
            {group.name} ({group.services.length})
          </option>
        ))}
      </select>
    </>
  )
}

export function ServicesStep({
  group,
  serviceIds,
  naming,
  onToggle,
  onToggleAll,
  onNaming,
  listText,
}: {
  group: WizardGroup
  serviceIds: number[]
  naming: ServiceNaming
  onToggle: (id: number, on: boolean) => void
  onToggleAll: (on: boolean) => void
  onNaming: (naming: ServiceNaming) => void
  /** Die aufgezählten Dienste, so wie sie im Text stünden (für die Beschriftung der Wahl) */
  listText: string
}) {
  const ta = useAdminText()
  const all = group.services.length > 0 && serviceIds.length === group.services.length
  return (
    <>
      <label className="iw-svc iw-svc--all">
        <input type="checkbox" data-testid="all" checked={all} onChange={(event) => onToggleAll(event.target.checked)} />
        <span className="iw-name">{ta('All services of the group')}</span>
      </label>
      {group.services.map((service) => (
        <label className="iw-svc" key={service.id}>
          <input type="checkbox" data-testid={`service-${service.id}`} checked={serviceIds.includes(service.id)} onChange={(event) => onToggle(service.id, event.target.checked)} />
          <span className="iw-name">{service.name}</span>
          {service.openIncident && <span className="iw-chip iw-chip--open" title={ta('There is already an open incident for this service')}>{ta('open incident')}</span>}
          <span className="iw-chip"><Dot state={service.status} />{stateLabel(service.status, ta)}</span>
        </label>
      ))}
      {all && group.services.length > 1 && (
        <div className="iw-mode" data-testid="naming">
          <b>{ta('Name the services in the text:')}</b>
          <label>
            <input type="radio" name="iw-naming" value="list" checked={naming === 'list'} onChange={() => onNaming('list')} /> {ta('list them one by one')} (<i>{listText}</i>)
          </label>
          <label>
            <input type="radio" name="iw-naming" value="group" checked={naming === 'group'} onChange={() => onNaming('group')} /> {ta('write "all services of the group {group}"').replace('{group}', group.name)}
          </label>
        </div>
      )}
    </>
  )
}

export function TemplateStep({ templates, choice, onChoose, kind = 'incident' }: { templates: WizardTemplate[]; choice: string | null; onChoose: (choice: string) => void; kind?: 'incident' | 'maintenance' }) {
  const ta = useAdminText()
  return (
    <>
      <div className="iw-tpl" role="radiogroup" aria-label={ta('Template')}>
        {templates.map((template) => (
          <label key={template.id} className={choice === String(template.id) ? 'iw-sel' : ''}>
            <input type="radio" name="iw-tpl" data-testid={`template-${template.id}`} checked={choice === String(template.id)} onChange={() => onChoose(String(template.id))} />
            <span className="iw-t">{template.name}</span>
            <span>{template.impact && <span className="iw-chip">{ta('Impact: {impact}').replace('{impact}', impactLabel(template.impact, ta))}</span>}</span>
          </label>
        ))}
        <label className={choice === 'none' ? 'iw-sel' : ''}>
          <input type="radio" name="iw-tpl" data-testid="template-none" checked={choice === 'none'} onChange={() => onChoose('none')} />
          <span className="iw-t">{ta('Without a template')}</span>
          <span />
        </label>
      </div>
      {templates.length === 0 && (
        <p className="iw-hint">
          {kind === 'maintenance'
            ? ta('There are no templates for a new maintenance yet. Create them under Status → Templates.')
            : ta('There are no templates for a new incident yet. Create them under Status → Templates.')}
        </p>
      )}
      <p className="iw-hint">
        {kind === 'maintenance'
          ? ta('Templates of the type maintenance with the status "Upcoming" are offered, because this is a new message.')
          : ta('Templates of the type incident with the status "Investigating" are offered, because this is a new message.')}
      </p>
    </>
  )
}

export function ImpactStep({ impact, presetFromTemplate, onChoose }: { impact: Impact | null; presetFromTemplate: boolean; onChoose: (impact: Impact) => void }) {
  const ta = useAdminText()
  return (
    <>
      <div className="iw-impact" role="radiogroup" aria-label={ta('Impact')}>
        {IMPACTS.map((candidate) => (
          <label key={candidate} className={impact === candidate ? 'iw-sel' : ''}>
            <input type="radio" name="iw-impact" data-testid={`impact-${candidate}`} checked={impact === candidate} onChange={() => onChoose(candidate)} />
            <Dot state={candidate} />
            {impactLabel(candidate, ta)}
          </label>
        ))}
      </div>
      <p className="iw-hint">
        {presetFromTemplate ? ta('Preset by the template, you can change it.') : ta('The template sets no impact: please choose one.')} {ta('The impact sets the state of the affected services.')}
      </p>
    </>
  )
}

const Counter = ({ length, max }: { length: number; max: number }) => {
  const ta = useAdminText()
  return (
    <div className={`iw-count${length > max ? ' iw-count--over' : ''}`} data-testid="counter">
      {ta('{length} / {max} characters').replace('{length}', String(length)).replace('{max}', String(max))}
      {length > max ? ` (${ta('too long')})` : ''}
    </div>
  )
}

export type TextTab = 'page' | 'sms' | 'ntfy'

export function TextsStep({ texts, tab, onTab, onChange }: { texts: DraftTexts; tab: TextTab; onTab: (tab: TextTab) => void; onChange: (key: keyof DraftTexts, value: string) => void }) {
  const ta = useAdminText()
  const tabs: Array<[TextTab, string]> = [
    ['page', ta('Status page and email')],
    ['sms', ta('SMS')],
    ['ntfy', ta('ntfy')],
  ]
  return (
    <>
      <div className="iw-tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'iw-on' : ''} onClick={() => onTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'page' && (
        <div>
          <label className="iw-label" htmlFor="iw-title">{ta('Title')}</label>
          <input type="text" id="iw-title" data-testid="title" value={texts.title} onChange={(event) => onChange('title', event.target.value)} />
          <label className="iw-label" htmlFor="iw-body">{ta('Text')}</label>
          <textarea id="iw-body" data-testid="body" rows={6} value={texts.body} onChange={(event) => onChange('body', event.target.value)} />
        </div>
      )}
      {tab === 'sms' && (
        <div>
          <label className="iw-label" htmlFor="iw-sms">{ta('SMS text (optional)')}</label>
          <textarea id="iw-sms" data-testid="sms" rows={3} value={texts.smsBody} onChange={(event) => onChange('smsBody', event.target.value)} />
          <Counter length={texts.smsBody.length} max={SMS_TEXT_MAX_LENGTH} />
        </div>
      )}
      {tab === 'ntfy' && (
        <div>
          <label className="iw-label" htmlFor="iw-ntfy">{ta('ntfy text (optional)')}</label>
          <textarea id="iw-ntfy" data-testid="ntfy" rows={3} value={texts.ntfyBody} onChange={(event) => onChange('ntfyBody', event.target.value)} />
          <Counter length={texts.ntfyBody.length} max={NTFY_TEXT_MAX_LENGTH} />
        </div>
      )}
      <p className="iw-hint">
        <code>{'{{link}}'}</code> {ta('stays in the text and is replaced by the address of the message when it is published.')}
      </p>
      <p className="iw-hint">{ta('If you change the services, the naming or the template, the text is filled in again from the template. Your own changes are lost then.')}</p>
    </>
  )
}

export function missingLabel(field: MissingField, ta: AdminText): string {
  switch (field) {
    case 'group':
      return ta('group')
    case 'services':
      return ta('at least one service')
    case 'template':
      return ta('template')
    case 'impact':
      return ta('impact')
    case 'title':
      return ta('title')
    case 'body':
      return ta('text')
    case 'sms-too-long':
      return ta('a shorter SMS text')
    default:
      return ta('a shorter ntfy text')
  }
}

export function PreviewView({
  texts,
  impact,
  services,
  onBack,
  onPublish,
  busy,
  error,
}: {
  texts: DraftTexts
  impact: Impact
  services: WizardService[]
  onBack: () => void
  onPublish: () => void
  busy: boolean
  error: string | null
}) {
  const ta = useAdminText()
  return (
    <div data-testid="preview">
      <h1>{ta('Preview and confirmation')}</h1>
      <p className="iw-lead">{ta('This is how the incident appears after publishing. Nothing is saved yet.')}</p>

      <h3 className="iw-ph">{ta('1. On the status page')}</h3>
      <div className={`iw-pubcard iw-pubcard--${impact}`} data-testid="pubcard">
        <div className="iw-top">
          <span className="iw-ttl">{texts.title}</span>
          <span className="iw-badge">{ta('Investigating')}</span>
          <span className="iw-chip"><Dot state={impact} />{impactLabel(impact, ta)}</span>
        </div>
        <div className="iw-time">{ta('Published with the current time.')}</div>
        {texts.body.split('\n').map((line, index) => (
          <p key={index}>{line}</p>
        ))}
        <div className="iw-chips">
          {services.map((service) => (
            <span className="iw-chip" key={service.id}>{service.name}</span>
          ))}
        </div>
      </div>

      <h3 className="iw-ph">{ta('2. What happens when you publish')}</h3>
      <ul className="iw-eff" data-testid="effects">
        <li>{ta('The incident appears on the status page immediately (as above).')}</li>
        <li>
          {ta('The state of the services changes:')}
          <ul>
            {services.map((service) => (
              <li key={service.id}>
                {service.name}: {stateLabel(service.status, ta)} → <b>{impactLabel(impact, ta)}</b>
              </li>
            ))}
          </ul>
        </li>
        <li>{ta('One entry per service is written to the status log.')}</li>
        <li>{ta('A notification draft is created. Nothing is sent automatically: you review and send it under Notifications.')}</li>
      </ul>

      <h3 className="iw-ph">{ta('3. Notification draft (not sent)')}</h3>
      <div className="iw-draft" data-testid="draft">
        <details open>
          <summary>{ta('Email')}</summary>
          <pre>{`${ta('Subject')}: [${ta('Investigating')}] ${texts.title}\n\n${texts.body}\n\n${ta('Link')}: ${ta('(inserted when published)')}`}</pre>
        </details>
        <details>
          <summary>{ta('SMS')} ({texts.smsBody.length})</summary>
          <pre>{texts.smsBody || ta('(none, the general SMS text from the settings is used)')}</pre>
        </details>
        <details>
          <summary>{ta('ntfy')} ({texts.ntfyBody.length})</summary>
          <pre>{texts.ntfyBody || ta('(none)')}</pre>
        </details>
      </div>

      {error && <p className="iw-error" role="alert">{error}</p>}
      <div className="iw-actions">
        <button type="button" className="iw-btn iw-btn--primary" data-testid="publish" disabled={busy} onClick={onPublish}>{ta('Publish now')}</button>
        <button type="button" className="iw-btn" data-testid="back" disabled={busy} onClick={onBack}>{ta('← Back to editing')}</button>
      </div>
    </div>
  )
}

export function DoneView({ title, impact, services, incidentUrl, draftsUrl, listUrl, onAgain }: { title: string; impact: Impact; services: WizardService[]; incidentUrl: string; draftsUrl: string; listUrl: string; onAgain: () => void }) {
  const ta = useAdminText()
  return (
    <div className="iw-done" data-testid="done">
      <h1><span className="iw-ok">✓</span> {ta('Incident published')}</h1>
      <p>{ta('"{title}" was published.').replace('{title}', title)}</p>
      <ul>
        <li>{ta('Service state set: {services} → {impact}').replace('{services}', services.map((s) => s.name).join(', ')).replace('{impact}', impactLabel(impact, ta))}</li>
        <li>{ta('Entry in the status log')}</li>
        <li>{ta('Notification draft created (not sent)')}</li>
      </ul>
      <div className="iw-actions">
        <a className="iw-btn" href={incidentUrl}>{ta('View incident')}</a>
        <a className="iw-btn iw-btn--primary" href={draftsUrl}>{ta('Review and send the notification')}</a>
        <a className="iw-btn" href={listUrl}>{ta('Back to the list')}</a>
        <button type="button" className="iw-btn" onClick={onAgain}>{ta('Report another incident')}</button>
      </div>
    </div>
  )
}
