'use client'

import React, { useCallback, useRef } from 'react'
import { useField } from '@payloadcms/ui'
import { FieldDescription } from '@payloadcms/ui/fields/FieldDescription'
import { FieldLabel } from '@payloadcms/ui/fields/FieldLabel'
import { nextIconIndex } from '@/lib/icon-picker'
import { GroupIconGrid, type IconOption } from './GroupIconGrid'
import './group-icon-field.scss'

type Props = {
  path: string
  field: { label?: string; required?: boolean; options?: unknown; admin?: { description?: string } }
  readOnly?: boolean
}

/** Optionen als einfache Liste: Payload liefert Zeichenketten oder Objekte mit Beschriftung und Wert. */
function toOptions(options: unknown): IconOption[] {
  if (!Array.isArray(options)) return []
  return options.flatMap((option): IconOption[] => {
    if (typeof option === 'string') return [{ label: option, value: option }]
    if (option && typeof option === 'object' && typeof (option as { value?: unknown }).value === 'string') {
      const { label, value } = option as { label?: unknown; value: string }
      return [{ label: typeof label === 'string' ? label : value, value }]
    }
    return []
  })
}

/**
 * Feld „Symbol“ einer Dienstgruppe: Raster aller Symbole mit Namen statt einer Auswahlliste. Der gespeicherte Wert bleibt derselbe
 * (Name des Symbols, zum Beispiel `Server`), bestehende Gruppen ändern sich nicht.
 */
export const GroupIconField: React.FC<Props> = ({ path, field, readOnly }) => {
  const { value, setValue, disabled } = useField<string>({ path })
  const options = toOptions(field.options)
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const locked = Boolean(readOnly || disabled)

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const next = nextIconIndex(event.key, index, options.length)
      if (next === null) return
      event.preventDefault()
      setValue(options[next].value)
      buttons.current[next]?.focus()
    },
    [options, setValue],
  )

  return (
    <div className="field-type group-icon-field">
      <FieldLabel label={field.label} path={path} required={field.required} />
      <GroupIconGrid
        options={options}
        value={value}
        disabled={locked}
        label={field.label ?? ''}
        onSelect={(next) => !locked && setValue(next)}
        onKeyDown={onKeyDown}
        setButtonRef={(index, element) => {
          buttons.current[index] = element
        }}
      />
      <FieldDescription description={field.admin?.description} path={path} />
    </div>
  )
}
