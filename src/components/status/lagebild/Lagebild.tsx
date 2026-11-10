'use client'

import Link from 'next/link'
import { useState } from 'react'
import { statusLabel, type LagebildData, type LagebildGroup, type LagebildPeriod } from '@/lib/lagebild'
import { t, tf } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { GroupIcon } from './GroupIcon'
import { StatusBar } from './StatusBar'
import { statusBadgeIcon, statusBorder, statusSoftBg, statusText } from './status-styles'

type Variant = 'a' | 'b'

type Props = {
  variant: Variant | 'both'
  data: LagebildData
  /** Gruppe aus der Adresse (`?gruppe=…`), falls vorhanden */
  initialGroup: string | null
}

/** Lagebild je Dienstgruppe: Kacheln, Balken der letzten 12 Stunden, Einschränkungen der letzten 14 Tage. */
export function Lagebild({ variant, data, initialGroup }: Props) {
  if (data.groups.length === 0) return null

  if (variant === 'both') {
    return (
      <div className="space-y-12">
        <p className="rounded-md border border-dashed border-border bg-secondary/50 px-4 py-2 text-sm text-muted-foreground">
          {t('lagebild.testNotice')}
        </p>
        <LagebildView variant="a" data={data} initialGroup={initialGroup} syncUrl={false} caption={t('lagebild.variantA')} />
        <LagebildView variant="b" data={data} initialGroup={initialGroup} syncUrl={false} caption={t('lagebild.variantB')} />
      </div>
    )
  }

  return <LagebildView variant={variant} data={data} initialGroup={initialGroup} syncUrl />
}

function LagebildView({
  variant,
  data,
  initialGroup,
  syncUrl,
  caption,
}: {
  variant: Variant
  data: LagebildData
  initialGroup: string | null
  syncUrl: boolean
  caption?: string
}) {
  const [selected, setSelected] = useState<string | null>(
    initialGroup && data.groups.some((group) => group.id === initialGroup) ? initialGroup : null,
  )

  function select(groupId: string | null) {
    const next = groupId === selected ? null : groupId
    setSelected(next)
    if (syncUrl) {
      const url = new URL(window.location.href)
      if (next) url.searchParams.set('gruppe', next)
      else url.searchParams.delete('gruppe')
      window.history.replaceState(null, '', url)
    }
  }

  return (
    <section className="animate-fade-in" data-testid={`lagebild-${variant}`}>
      <h2 className="mb-4 text-xl font-bold text-foreground">
        {t('lagebild.title')}
        {caption && <span className="ml-2 text-sm font-medium text-muted-foreground">({caption})</span>}
      </h2>

      <div
        className={cn(
          'grid gap-3',
          variant === 'a' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2',
        )}
      >
        {data.groups.map((group) =>
          variant === 'a' ? (
            <TileA key={group.id} group={group} active={selected === group.id} onSelect={() => select(group.id)} />
          ) : (
            <TileB
              key={group.id}
              group={group}
              active={selected === group.id}
              onSelect={() => select(group.id)}
              from={data.barsFrom}
              to={data.barsTo}
            />
          ),
        )}
      </div>

      {variant === 'a' && (
        <div className="mt-8">
          <h3 className="mb-3 text-lg font-semibold text-foreground">{t('lagebild.barsTitle')}</h3>
          <div className="space-y-2 rounded-lg border border-border bg-card p-4">
            {data.groups.map((group) => (
              <div key={group.id} className="flex items-center gap-3">
                <div className="flex w-36 shrink-0 items-center gap-2 text-sm font-medium text-foreground sm:w-44">
                  <GroupIcon name={group.icon} className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{group.name}</span>
                </div>
                <StatusBar runs={group.bars} label={`${group.name}: ${statusLabel(group.status)}`} />
              </div>
            ))}
            <div className="flex justify-between pl-[9.75rem] text-xs text-muted-foreground sm:pl-[12.5rem]">
              <span>{data.barsFrom}</span>
              <span>{t('lagebild.now')}</span>
            </div>
          </div>
        </div>
      )}

      <PeriodList data={data} selected={selected} onSelect={select} />
    </section>
  )
}

function TileA({ group, active, onSelect }: { group: LagebildGroup; active: boolean; onSelect: () => void }) {
  const Badge = statusBadgeIcon[group.status]
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      title={`${group.name}: ${statusLabel(group.status)}`}
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border bg-card px-3 py-4 text-center transition-colors hover:bg-secondary/60',
        active ? 'border-primary ring-2 ring-primary/30' : 'border-border',
      )}
    >
      <span className={cn('relative flex h-14 w-14 items-center justify-center rounded-xl', statusSoftBg[group.status])}>
        <GroupIcon name={group.icon} className={cn('h-7 w-7', statusText[group.status])} />
        <span className="absolute -bottom-2 -right-2 rounded-full bg-card">
          <Badge className={cn('h-5 w-5', statusText[group.status])} aria-hidden="true" />
        </span>
      </span>
      <span className="text-sm font-semibold text-foreground">{group.name}</span>
      <span className="sr-only">{statusLabel(group.status)}</span>
    </button>
  )
}

function TileB({
  group,
  active,
  onSelect,
  from,
  to,
}: {
  group: LagebildGroup
  active: boolean
  onSelect: () => void
  from: string
  to: string
}) {
  const Badge = statusBadgeIcon[group.status]
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-l-4 bg-card px-4 py-3 text-left transition-colors hover:bg-secondary/60',
        statusBorder[group.status],
        active && 'ring-2 ring-primary/30',
      )}
    >
      <span className="flex items-center gap-3">
        <GroupIcon name={group.icon} className="h-6 w-6 shrink-0 text-muted-foreground" />
        <span className="flex-1">
          <span className="block text-sm font-semibold text-foreground">{group.name}</span>
          <span className={cn('block text-xs font-semibold', statusText[group.status])}>{statusLabel(group.status)}</span>
        </span>
        <Badge className={cn('h-5 w-5 shrink-0', statusText[group.status])} aria-hidden="true" />
      </span>
      <span className="block">
        <StatusBar runs={group.bars} heightClass="h-3" label={`${group.name}: ${statusLabel(group.status)}`} />
        <span className="mt-1 flex justify-between text-[11px] text-muted-foreground">
          <span>{from}</span>
          <span>{to}</span>
        </span>
      </span>
    </button>
  )
}

function PeriodList({
  data,
  selected,
  onSelect,
}: {
  data: LagebildData
  selected: string | null
  onSelect: (groupId: string | null) => void
}) {
  const visible = data.periods.filter((period) => !selected || period.groupId === selected)

  // Tage mit Einträgen einzeln, aufeinanderfolgende leere Tage zu einer Zeile zusammenfassen
  type Block =
    | { kind: 'day'; day: LagebildData['days'][number]; items: LagebildPeriod[] }
    | { kind: 'empty'; key: string; label: string }
  const blocks: Block[] = []
  let emptyRun: LagebildData['days'] = []
  const flushEmpty = () => {
    if (emptyRun.length === 0) return
    const newest = emptyRun[0]
    const oldest = emptyRun[emptyRun.length - 1]
    blocks.push({
      kind: 'empty',
      key: `empty-${newest.dayKey}`,
      label: emptyRun.length === 1 ? newest.dayLabel : `${oldest.dayLabel} – ${newest.dayLabel}`,
    })
    emptyRun = []
  }
  for (const day of data.days) {
    const items = visible.filter((period) => period.dayKey === day.dayKey)
    if (items.length === 0) {
      emptyRun.push(day)
    } else {
      flushEmpty()
      blocks.push({ kind: 'day', day, items })
    }
  }
  flushEmpty()

  return (
    <div className="mt-8">
      <h3 className="mb-3 text-lg font-semibold text-foreground">{t('lagebild.periodsTitle')}</h3>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={t('lagebild.filterLabel')}>
        <Chip active={selected === null} onClick={() => selected !== null && onSelect(selected)}>
          {t('lagebild.allGroups')}
        </Chip>
        {data.groups.map((group) => (
          <Chip key={group.id} active={selected === group.id} onClick={() => selected !== group.id && onSelect(group.id)}>
            {group.name}
          </Chip>
        ))}
      </div>

      <div className="space-y-4">
        {blocks.map((block) =>
          block.kind === 'empty' ? (
            <p key={block.key} className="rounded-md bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{block.label}</span>
              {': '}
              {t('lagebild.noEntries')}
            </p>
          ) : (
            <div key={block.day.dayKey}>
              <h4 className="mb-2 text-sm font-bold text-foreground">{block.day.dayLabel}</h4>
              <ul className="space-y-2">
                {block.items.map((period) => (
                  <li
                    key={period.id}
                    className={cn('flex items-center gap-3 rounded-md border border-l-4 bg-card px-3 py-2.5', statusBorder[period.status])}
                  >
                    <GroupIcon name={period.groupIcon} className={cn('h-5 w-5 shrink-0', statusText[period.status])} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{period.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {period.range}
                        {period.related && (
                          <>
                            {' · '}
                            <Link href={period.related.href} className="text-primary hover:underline">
                              {tf('lagebild.relatedIncident', { title: period.related.title })}
                            </Link>
                          </>
                        )}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-xs font-bold',
                        statusSoftBg[period.status],
                        statusText[period.status],
                      )}
                    >
                      {statusLabel(period.status)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ),
        )}
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-foreground hover:bg-secondary/60',
      )}
    >
      {children}
    </button>
  )
}
