'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useAllFormFields, useDocumentInfo, useForm } from '@payloadcms/ui'
import { useAdminText } from '@/lib/i18n/admin-client'
import { impactLabel } from '@/components/admin/incident-wizard/IncidentWizardParts'
import { IMPACTS, type Impact } from '@/lib/incident-draft'
import {
  fillUpdateTemplate,
  idsOf,
  isNewUpdate,
  siblingPath,
  templatesForStatus,
  type UpdateTemplate,
} from '@/lib/update-template'
import './update-template.scss'

type Props = { path: string }

type ServiceInfo = { id: number; name: string; groupName: string | null }

/**
 * Auswahl „Vorlage einfügen“ über dem Feld „Nachricht“ einer neuen Aktualisierung einer Störung. Zeigt die Vorlagen der Art
 * „Störung“ zum gewählten Status. Die Wahl füllt Nachricht, SMS- und ntfy-Text der Zeile; die Platzhalter kommen aus den
 * betroffenen Diensten und der Auswirkung im Formular. Gespeichert wird erst mit „Speichern“.
 */
export const UpdateTemplatePicker: React.FC<Props> = ({ path }) => {
  const ta = useAdminText()
  const { initialData } = useDocumentInfo()
  const { dispatchFields, setModified } = useForm()
  const [fields] = useAllFormFields()

  const statusPath = siblingPath(path, 'status')
  const idPath = siblingPath(path, 'id')
  const status = fields[statusPath]?.value as string | undefined
  const message = (fields[path]?.value as string | undefined) ?? ''
  const rowId = fields[idPath]?.value
  const serviceIds = idsOf(fields.affectedServices?.value)
  const impactValue = fields.impact?.value as string | undefined

  const savedIds = useMemo(() => {
    const updates = (initialData as { updates?: Array<{ id?: unknown }> } | undefined)?.updates
    return new Set((updates ?? []).map((update) => String(update.id)))
  }, [initialData])
  const isNew = isNewUpdate(rowId, savedIds)

  const [templates, setTemplates] = useState<UpdateTemplate[]>([])
  const [locale, setLocale] = useState('en')
  const [services, setServices] = useState<ServiceInfo[]>([])
  const [inserted, setInserted] = useState<{ text: string; sms: string; ntfy: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/message-templates?where[kind][equals]=incident&sort=name&limit=200&depth=0')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.docs) setTemplates(data.docs as UpdateTemplate[])
      })
      .catch(() => {})
    fetch('/api/globals/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        // Sprache der Aufzählung: eingestellte Locale, sonst Sprache der Oberfläche
        if (!cancelled && data) setLocale((data.locale as string | null) || document.documentElement.lang || 'en')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const idKey = serviceIds.join(',')
  useEffect(() => {
    if (!idKey) {
      setServices([])
      return
    }
    let cancelled = false
    fetch(`/api/services?where[id][in]=${idKey}&depth=1&pagination=false&sort=_order`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.docs) return
        setServices(
          (data.docs as Array<{ id: number; name: string; group?: { name?: string } | number | null }>).map((doc) => ({
            id: doc.id,
            name: doc.name,
            groupName: doc.group && typeof doc.group === 'object' ? (doc.group.name ?? null) : null,
          })),
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [idKey])

  if (!isNew) return null

  const options = templatesForStatus(templates, status)

  function choose(value: string) {
    const template = options.find((candidate) => String(candidate.id) === value)
    if (!template) return
    if (message.trim() !== '' && message !== inserted?.text && !window.confirm(ta('Replace the existing text?'))) return
    const impact = IMPACTS.includes(impactValue as Impact) ? impactLabel(impactValue as Impact, ta) : ''
    const groupNames = [...new Set(services.map((service) => service.groupName).filter((name): name is string => Boolean(name)))]
    const texts = fillUpdateTemplate(template, { serviceNames: services.map((service) => service.name), groupNames, impact, locale })
    dispatchFields({ type: 'UPDATE', path, value: texts.message })
    dispatchFields({ type: 'UPDATE', path: siblingPath(path, 'smsBody'), value: texts.smsBody })
    dispatchFields({ type: 'UPDATE', path: siblingPath(path, 'ntfyBody'), value: texts.ntfyBody })
    setModified(true)
    setInserted({ text: texts.message, sms: texts.smsBody, ntfy: texts.ntfyBody })
  }

  const edited = inserted !== null && message !== inserted.text
  const hasShortTexts = inserted !== null && (inserted.sms !== '' || inserted.ntfy !== '')

  return (
    <div className="update-template" data-testid="update-template">
      <label className="update-template__label" htmlFor={`update-template-${path}`}>
        {ta('Insert template')}
      </label>
      <select
        id={`update-template-${path}`}
        className="update-template__select"
        data-testid="update-template-select"
        value=""
        disabled={options.length === 0}
        onChange={(event) => choose(event.target.value)}
      >
        <option value="">{options.length === 0 ? ta('No template for this status') : ta('Choose a template …')}</option>
        {options.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name}
          </option>
        ))}
      </select>
      {options.length === 0 && (
        <p className="update-template__hint">{ta('Create templates under Status → Templates.')}</p>
      )}
      {serviceIds.length === 0 && options.length > 0 && (
        <p className="update-template__warn" data-testid="update-template-no-services">
          {ta('The incident has no affected services. The placeholder for the services stays empty.')}
        </p>
      )}
      {hasShortTexts && !edited && (
        <p className="update-template__ok" data-testid="update-template-carried">
          {ta('The SMS and ntfy texts of the template go into the notification draft.')}
        </p>
      )}
      {edited && (
        <p className="update-template__warn" data-testid="update-template-edited">
          {ta('You changed the text. The SMS and ntfy texts still come from the template.')}
        </p>
      )}
    </div>
  )
}
