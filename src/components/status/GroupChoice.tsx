"use client";

import { useTranslation } from '@/lib/i18n/client'
import type { Translate, TranslateFormat } from '@/lib/i18n/core'
import { cn } from '@/lib/utils'

export interface GroupOption {
  id: number
  name: string
}

export interface GroupChoiceValue {
  allGroups: boolean
  groups: number[]
}

/** Gültig ist „alle Dienstgruppen“ oder eine nicht leere Auswahl. */
export function isGroupChoiceValid(value: GroupChoiceValue): boolean {
  return value.allGroups || value.groups.length > 0
}

/** Kurzfassung der Wahl für die Erfolgsmeldung: „alle“ oder die Zahl der gewählten Gruppen. */
export function describeChoice(value: GroupChoiceValue, t: Translate, tf: TranslateFormat): string {
  return value.allGroups ? t('sub.successScopeAll') : tf('sub.successScopeSome', { count: value.groups.length })
}

/** Gruppen, deren Name den Suchtext enthält (ohne Groß- und Kleinschreibung, Leerraum am Rand zählt nicht). */
export function filterGroups<T extends { name: string }>(groups: T[], query: string): T[] {
  const needle = query.trim().toLowerCase()
  return needle ? groups.filter((group) => group.name.toLowerCase().includes(needle)) : groups
}

interface GroupChoiceProps {
  groups: GroupOption[]
  value: GroupChoiceValue
  onChange: (value: GroupChoiceValue) => void
  /** Suchtext, wenn der Aufrufer ihn führt (Standard: leer, die Suche wirkt dann nur beim Aufrufer). */
  query?: string
  onQueryChange?: (query: string) => void
  /** Vorsatz für die Kennungen der Felder, damit mehrere Blöcke auf einer Seite nicht kollidieren. */
  idPrefix?: string
  /** Die Liste wird gerade geladen: statt „keine Dienstgruppe“ erscheint ein Ladehinweis. */
  loading?: boolean
}

/**
 * Gruppenwahl der Abonnenten: Haken „alle Dienstgruppen“ oder Auswahl mit Suche. Gemeinsam genutzt vom
 * Anmeldedialog und von der Seite „Auswahl ändern“.
 */
export function GroupChoice({ groups, value, onChange, query = '', onQueryChange, idPrefix = 'groups', loading = false }: GroupChoiceProps) {
  const { t, tf } = useTranslation()
  const shown = filterGroups(groups, query)
  const chosen = new Set(value.groups)

  const toggle = (id: number) => {
    const next = new Set(chosen)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange({ allGroups: false, groups: [...next] })
  }

  return (
    <div className="border-t border-border pt-4">
    <fieldset className="m-0 min-w-0 space-y-3 border-0 p-0">
      <legend className="mb-3 p-0 text-sm font-medium text-foreground">{t('sub.groupsTitle')}</legend>

      <label
        htmlFor={`${idPrefix}-all`}
        className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-3"
      >
        <input
          id={`${idPrefix}-all`}
          type="checkbox"
          checked={value.allGroups}
          // Die Auswahl bleibt beim Umschalten erhalten, nur der Suchtext wird geleert
          onChange={(e) => {
            onChange({ allGroups: e.target.checked, groups: value.groups })
            onQueryChange?.('')
          }}
          className="mt-0.5 h-4 w-4 flex-shrink-0 accent-primary"
        />
        <span>
          <span className="block text-sm font-medium text-foreground">{t('sub.groupsAll')}</span>
          <span className="block text-xs text-muted-foreground">{t('sub.groupsAllHint')}</span>
        </span>
      </label>

      {value.allGroups ? (
        <p className="text-xs text-muted-foreground">{t('sub.groupsPickHint')}</p>
      ) : (
        <div className="space-y-2">
          <label htmlFor={`${idPrefix}-search`} className="sr-only">
            {t('sub.groupsSearch')}
          </label>
          <input
            id={`${idPrefix}-search`}
            type="search"
            value={query}
            onChange={(e) => onQueryChange?.(e.target.value)}
            // Enter im Suchfeld darf das Anmeldeformular nicht absenden: Die Wahl wäre sonst unvollständig
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault()
            }}
            placeholder={t('sub.groupsSearch')}
            className={cn(
              'w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground',
              'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50',
            )}
          />
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span aria-live="polite">{tf('sub.groupsCount', { chosen: value.groups.length, total: groups.length })}</span>
            <button
              type="button"
              disabled={value.groups.length === 0}
              onClick={() => onChange({ allGroups: false, groups: [] })}
              className="p-0.5 text-foreground underline disabled:cursor-default disabled:text-muted-foreground disabled:no-underline"
            >
              {t('sub.groupsClear')}
            </button>
          </div>
          <ul className="max-h-60 overflow-y-auto rounded-lg border border-border bg-background p-1">
            {shown.length === 0 ? (
              <li className="px-2 py-4 text-center text-sm text-muted-foreground">{loading ? t('sub.groupsLoading') : t('sub.groupsNone')}</li>
            ) : (
              shown.map((group) => (
                <li key={group.id}>
                  <label
                    htmlFor={`${idPrefix}-g${group.id}`}
                    className="flex cursor-pointer items-center gap-3 rounded-md p-2 text-sm text-foreground hover:bg-muted"
                  >
                    <input
                      id={`${idPrefix}-g${group.id}`}
                      type="checkbox"
                      data-group={group.id}
                      checked={chosen.has(group.id)}
                      onChange={() => toggle(group.id)}
                      className="h-4 w-4 flex-shrink-0 accent-primary"
                    />
                    {group.name}
                  </label>
                </li>
              ))
            )}
          </ul>
          {value.groups.length === 0 && !loading && (
            <p role="alert" className="text-xs text-destructive">
              {t('sub.groupsRequired')}
            </p>
          )}
        </div>
      )}
    </fieldset>
    </div>
  )
}
