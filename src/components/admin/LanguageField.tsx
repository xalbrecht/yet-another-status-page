'use client'

import React from 'react'
import { useField } from '@payloadcms/ui'
import { FieldDescription } from '@payloadcms/ui/fields/FieldDescription'
import { FieldError } from '@payloadcms/ui/fields/FieldError'
import { FieldLabel } from '@payloadcms/ui/fields/FieldLabel'

type LanguageFieldProps = {
  path: string
  field: { label?: string; admin?: { description?: string } }
  readOnly?: boolean
  // clientProps aus Settings.ts: die beim Start geladenen Sprachen
  options: { code: string; name: string }[]
  defaultCode: string
  defaultLabel: string
}

// Auswahlliste für die Sprache. Die Datenbank speichert nur den Code als Text, damit eine neue
// Sprachdatei keine Migration braucht (ein select von Payload legt einen Enum an).
export const LanguageField: React.FC<LanguageFieldProps> = ({ path, field, readOnly, options, defaultCode, defaultLabel }) => {
  const { value, setValue, showError, disabled } = useField<string>({ path })
  const defaultName = options.find((option) => option.code === defaultCode)?.name ?? defaultCode
  const known = !value || options.some((option) => option.code === value)

  return (
    <div className={`field-type text${showError ? ' error' : ''}`}>
      <FieldLabel label={field.label} path={path} />
      <div className="field-type__wrap">
        <FieldError path={path} showError={showError} />
        <select
          id={`field-${path.replace(/\./g, '__')}`}
          className="select-input"
          value={value ?? ''}
          disabled={readOnly || disabled}
          onChange={(event) => setValue(event.target.value)}
        >
          <option value="">{`${defaultLabel} (${defaultName})`}</option>
          {options.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
          {!known && <option value={value}>{value}</option>}
        </select>
        <FieldDescription description={field.admin?.description} path={path} />
      </div>
    </div>
  )
}
