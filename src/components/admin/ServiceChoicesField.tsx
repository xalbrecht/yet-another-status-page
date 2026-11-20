'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useAllFormFields, useDocumentInfo, useForm } from '@payloadcms/ui'
import type { ArrayFieldClientComponent } from 'payload'
import { buildChoiceRows, choicesApply, withoutBlocked } from '@/lib/service-choices'
import type { RememberableStatus } from '@/lib/service-status-sync'
import { ServiceChoicesView, type ServiceChoiceItem } from './ServiceChoicesView'
import './ServiceChoicesField.scss'

type Known = { name: string; remembered: RememberableStatus | null; blocked: boolean }

const idOf = (value: unknown): number | string | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'object') return (value as { id?: number | string; value?: number | string }).id ?? (value as { value?: number | string }).value ?? null
  return value as number | string
}

/**
 * Ersetzt die Zeilenansicht des Feldes „serviceChoices“ am Vorfall (Issue #210). Für jeden betroffenen Dienst mit gemerktem
 * Zustand liegt eine Zeile im Formular (Dienst und Haken), vorbelegt „Zurück“. Der Haken schreibt in die Zeile, das Speichern
 * übernimmt Payload. Ohne gemerkten Zustand bleibt das Feld unsichtbar und ohne Zeilen.
 */
export const ServiceChoicesField: ArrayFieldClientComponent = ({ path, schemaPath }) => {
  const [fields] = useAllFormFields()
  const { addFieldRow, removeFieldRow, dispatchFields } = useForm()
  const { id: incidentId } = useDocumentInfo()
  const [known, setKnown] = useState<Record<string, Known> | null>(null)

  const affectedValue = fields.affectedServices?.value
  const affected = useMemo(() => (Array.isArray(affectedValue) ? affectedValue.map(idOf).filter((id): id is number | string => id !== null) : []), [affectedValue])
  const affectedKey = affected.map(String).join(',')

  // Namen und gemerkte Zustände der betroffenen Dienste laden
  useEffect(() => {
    if (affected.length === 0) {
      setKnown({})
      return
    }
    let cancelled = false
    const ids = affected.map(encodeURIComponent).join(',')
    const services = fetch(`/api/services?where[id][in]=${ids}&depth=0&limit=${affected.length}`, { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : { docs: [] }))
    // Weitere offene Vorfälle an denselben Diensten: Die Wahl wirkt erst beim Ende des letzten
    const others = fetch(
      `/api/incidents?where[status][not_equals]=resolved&where[affectedServices][in]=${ids}${incidentId ? `&where[id][not_equals]=${incidentId}` : ''}&depth=0&limit=200`,
      { credentials: 'include' },
    ).then((response) => (response.ok ? response.json() : { docs: [] }))
    Promise.all([services, others])
      .then(([serviceBody, incidentBody]: [
        { docs?: Array<{ id: number | string; name: string; statusBeforeIncident?: RememberableStatus | null }> },
        { docs?: Array<{ affectedServices?: unknown[] }> },
      ]) => {
        if (cancelled) return
        const blocked = new Set<string>()
        for (const incident of incidentBody.docs ?? []) for (const entry of incident.affectedServices ?? []) blocked.add(String(idOf(entry)))
        const next: Record<string, Known> = {}
        for (const doc of serviceBody.docs ?? [])
          next[String(doc.id)] = { name: doc.name, remembered: doc.statusBeforeIncident ?? null, blocked: blocked.has(String(doc.id)) }
        setKnown(next)
      })
      .catch(() => !cancelled && setKnown({}))
    return () => {
      cancelled = true
    }
    // affectedKey bildet die Liste der IDs ab
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [affectedKey, incidentId])

  // Nur bei einer neuen Behebung gilt die Auswahl (siehe choicesApply)
  const updateRows = fields.updates?.rows?.length ?? 0
  const lastStatus = updateRows > 0 ? (fields[`updates.${updateRows - 1}.status`]?.value as string | undefined) : undefined
  const lastInitialStatus = updateRows > 0 ? (fields[`updates.${updateRows - 1}.status`]?.initialValue as string | undefined) : undefined
  const applies = choicesApply(lastStatus, lastInitialStatus)

  const rowCount = fields[path]?.rows?.length ?? 0
  const existing = Array.from({ length: rowCount }, (_, index) => ({
    service: fields[`${path}.${index}.service`]?.value,
    restore: fields[`${path}.${index}.restore`]?.value as boolean | undefined,
  }))
  const existingKey = existing.map((row) => `${String(idOf(row.service))}:${row.restore}`).join('|')

  // Zeilen mit den Diensten abgleichen: überzählige entfernen, fehlende vorbelegt anlegen
  useEffect(() => {
    if (!known || !applies) return
    const remembered = withoutBlocked(
      Object.fromEntries(Object.entries(known).map(([id, value]) => [id, value.remembered])),
      new Set(Object.entries(known).filter(([, value]) => value.blocked).map(([id]) => id)),
    )
    const desired = buildChoiceRows(affected, remembered, existing)
    const desiredIds = desired.map((row) => String(row.service))
    const keep = new Set<string>()
    const remove: number[] = []
    existing.forEach((row, index) => {
      const id = String(idOf(row.service))
      if (desiredIds.includes(id) && !keep.has(id)) keep.add(id)
      else remove.push(index)
    })
    const missing = desired.filter((row) => !keep.has(String(row.service)))
    if (remove.length === 0 && missing.length === 0) return
    for (const index of remove.sort((a, b) => b - a)) removeFieldRow({ path, rowIndex: index })
    let next = existing.length - remove.length
    for (const row of missing) {
      addFieldRow({
        path,
        rowIndex: next++,
        schemaPath: schemaPath ?? path,
        subFieldState: {
          service: { value: row.service, initialValue: row.service, valid: true, passesCondition: true },
          restore: { value: row.restore, initialValue: row.restore, valid: true, passesCondition: true },
        },
      })
    }
    // existingKey und affectedKey bilden die Eingaben ab
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [known, applies, existingKey, affectedKey])

  const items: ServiceChoiceItem[] = existing.flatMap((row) => {
    const id = idOf(row.service)
    const info = id === null ? undefined : known?.[String(id)]
    return applies && id !== null && info?.remembered && !info.blocked ? [{ id, name: info.name, remembered: info.remembered, restore: row.restore !== false }] : []
  })

  return (
    <ServiceChoicesView
      items={items}
      onChange={(id, restore) => {
        const index = existing.findIndex((row) => String(idOf(row.service)) === String(id))
        if (index >= 0) dispatchFields({ type: 'UPDATE', path: `${path}.${index}.restore`, value: restore, initialValue: undefined })
      }}
    />
  )
}
