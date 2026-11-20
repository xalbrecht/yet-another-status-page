'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useAllFormFields, useForm } from '@payloadcms/ui'
import type { ArrayFieldClientComponent } from 'payload'
import { buildChoiceRows } from '@/lib/service-choices'
import type { RememberableStatus } from '@/lib/service-status-sync'
import { ServiceChoicesView, type ServiceChoiceItem } from './ServiceChoicesView'
import './ServiceChoicesField.scss'

type Known = { name: string; remembered: RememberableStatus | null }

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
    const query = `where[id][in]=${affected.map(encodeURIComponent).join(',')}&depth=0&limit=${affected.length}`
    fetch(`/api/services?${query}`, { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : { docs: [] }))
      .then((body: { docs?: Array<{ id: number | string; name: string; statusBeforeIncident?: RememberableStatus | null }> }) => {
        if (cancelled) return
        const next: Record<string, Known> = {}
        for (const doc of body.docs ?? []) next[String(doc.id)] = { name: doc.name, remembered: doc.statusBeforeIncident ?? null }
        setKnown(next)
      })
      .catch(() => !cancelled && setKnown({}))
    return () => {
      cancelled = true
    }
    // affectedKey bildet die Liste der IDs ab
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [affectedKey])

  const rowCount = fields[path]?.rows?.length ?? 0
  const existing = Array.from({ length: rowCount }, (_, index) => ({
    service: fields[`${path}.${index}.service`]?.value,
    restore: fields[`${path}.${index}.restore`]?.value as boolean | undefined,
  }))
  const existingKey = existing.map((row) => `${String(idOf(row.service))}:${row.restore}`).join('|')

  // Zeilen mit den Diensten abgleichen: überzählige entfernen, fehlende vorbelegt anlegen
  useEffect(() => {
    if (!known) return
    const remembered = Object.fromEntries(Object.entries(known).map(([id, value]) => [id, value.remembered]))
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
  }, [known, existingKey, affectedKey])

  const items: ServiceChoiceItem[] = existing.flatMap((row) => {
    const id = idOf(row.service)
    const info = id === null ? undefined : known?.[String(id)]
    return id !== null && info?.remembered ? [{ id, name: info.name, remembered: info.remembered, restore: row.restore !== false }] : []
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
