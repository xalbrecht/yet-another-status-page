'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { Fragment, useLayoutEffect, useRef, useState, useTransition } from 'react'
import {
  BAR_HOURS_OPTIONS,
  PERIOD_OPTIONS,
  statusLabel,
  worstStatus,
  type BarRun,
  type LagebildData,
  type LagebildGroup,
  type LagebildStatus,
  type BarHours,
  type LagebildPeriod,
  type PeriodDays,
} from '@/lib/lagebild'
import { t, tf } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { AllGroupsPanel } from './AllGroupsPanel'
import { BarLegend } from './BarLegend'
import { GroupIcon } from './GroupIcon'
import { StatusBar } from './StatusBar'
import { statusBadgeIcon, statusBorder, statusSoftBg, statusText } from './status-styles'

type Variant = 'a' | 'b'

/** Auswahl „Alle“: die Kachel zeigt eine Zeile je Gruppe. Steht nie in der Adresse. */
export const ALL_GROUPS = '__all__'

/** Angaben einer Kachel, gleich für die Kachel „Alle“ und die Kacheln der Gruppen. */
type TileModel = {
  id: string
  name: string
  status: LagebildStatus
  meta: string
  bars: BarRun[]
  /** Symbol der Gruppe, `null` bei der Kachel „Alle“ */
  icon: string | null
}

type Props = {
  variant: Variant | 'both'
  data: LagebildData
  /** Gruppe aus der Adresse (`?gruppe=…`), falls vorhanden */
  initialGroup: string | null
  /** Vorgabe des Admins für die Rückschau */
  defaultPeriodDays: PeriodDays
  /** Vorgabe des Admins für den Zeitraum des Balkens */
  defaultBarHours: BarHours
}

/** Lagebild je Dienstgruppe: Kacheln mit aufklappbaren Diensten, Einschränkungen der gewählten Rückschau. */
export function Lagebild({ variant, data, initialGroup, defaultPeriodDays, defaultBarHours }: Props) {
  if (data.groups.length === 0) return null

  if (variant === 'both') {
    return (
      <div className="space-y-12">
        <p className="rounded-md border border-dashed border-border bg-secondary/50 px-4 py-2 text-sm text-muted-foreground">
          {t('lagebild.testNotice')}
        </p>
        <LagebildView variant="a" data={data} initialGroup={initialGroup} defaultPeriodDays={defaultPeriodDays} defaultBarHours={defaultBarHours} syncUrl={false} caption={t('lagebild.variantA')} />
        <LagebildView variant="b" data={data} initialGroup={initialGroup} defaultPeriodDays={defaultPeriodDays} defaultBarHours={defaultBarHours} syncUrl={false} caption={t('lagebild.variantB')} />
      </div>
    )
  }

  return (
    <LagebildView
      variant={variant}
      data={data}
      initialGroup={initialGroup}
      defaultPeriodDays={defaultPeriodDays}
      defaultBarHours={defaultBarHours}
      syncUrl
    />
  )
}

function LagebildView({
  variant,
  data,
  initialGroup,
  defaultPeriodDays,
  defaultBarHours,
  syncUrl,
  caption,
}: {
  variant: Variant
  data: LagebildData
  initialGroup: string | null
  defaultPeriodDays: PeriodDays
  defaultBarHours: BarHours
  syncUrl: boolean
  caption?: string
}) {
  const router = useRouter()
  const [barPending, startBarTransition] = useTransition()

  /** Zeitraum des Balkens über die Adresse wechseln, damit der Server neu rechnet. Die Vorgabe des Admins erscheint nicht in der Adresse. */
  function changeBarHours(hours: BarHours) {
    const url = new URL(window.location.href)
    if (hours === defaultBarHours) url.searchParams.delete('balken')
    else url.searchParams.set('balken', String(hours))
    startBarTransition(() => router.replace(`${url.pathname}${url.search}`, { scroll: false }))
  }

  // Ohne Gruppe in der Adresse ist in Variante A „Alle“ vorgewählt, in B nichts
  const [selected, setSelected] = useState<string | null>(
    initialGroup && data.groups.some((group) => group.id === initialGroup)
      ? initialGroup
      : variant === 'a'
        ? ALL_GROUPS
        : null,
  )

  const tiles: TileModel[] = [
    {
      id: ALL_GROUPS,
      name: t('lagebild.allTile'),
      status: worstStatus(data.groups.map((group) => group.status)) ?? 'operational',
      meta: groupsMeta(data.groups),
      bars: data.allBars,
      icon: null,
    },
    ...data.groups.map((group) => ({
      id: group.id,
      name: group.name,
      status: group.status,
      meta: serviceMeta(group),
      bars: group.bars,
      icon: group.icon,
    })),
  ]

  const gridRef = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(4)
  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const measure = () => setColumns(Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').length))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(grid)
    return () => observer.disconnect()
  }, [])

  function select(groupId: string | null) {
    const next = groupId === selected ? null : groupId
    setSelected(next)
    if (syncUrl) {
      const url = new URL(window.location.href)
      if (next && next !== ALL_GROUPS) url.searchParams.set('gruppe', next)
      else url.searchParams.delete('gruppe')
      window.history.replaceState(null, '', url)
    }
  }

  return (
    <section className="animate-fade-in" data-testid={`lagebild-${variant}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-foreground">
          {t('lagebild.title')}
          {caption && <span className="ml-2 text-sm font-medium text-muted-foreground">({caption})</span>}
        </h2>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t('lagebild.barLabel')}
          <select
            value={data.barHours}
            disabled={barPending}
            onChange={(event) => changeBarHours(Number(event.target.value) as BarHours)}
            data-testid={`lagebild-bar-hours-${variant}`}
            className="rounded-md border border-border bg-card px-2 py-1 text-sm font-medium text-foreground"
          >
            {BAR_HOURS_OPTIONS.map((hours) => (
              <option key={hours} value={hours}>
                {t(`lagebild.barHours.${hours}` as const)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        ref={gridRef}
        className={cn(
          'grid gap-3',
          variant === 'a' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2',
        )}
      >
        {tiles.map((tile, index) => {
          const open = selected === tile.id
          // Aufklappbereich steht hinter der letzten Kachel der Zeile
          const endsRow = index === tiles.length - 1 || (index + 1) % columns === 0
          const panelIndex = selected ? tiles.findIndex((candidate) => candidate.id === selected) : -1
          const panelInRow = endsRow && panelIndex >= 0 && Math.floor(panelIndex / columns) === Math.floor(index / columns)
          const panelGroup = panelInRow ? data.groups.find((group) => group.id === selected) : undefined
          const caretPercent = (((panelIndex % columns) + 0.5) / columns) * 100
          return (
            <Fragment key={tile.id}>
              {variant === 'a' ? (
                <TileA tile={tile} active={open} onSelect={() => select(tile.id)} />
              ) : (
                <TileB tile={tile} active={open} onSelect={() => select(tile.id)} bar={data.bar} from={data.barsFrom} to={data.barsTo} />
              )}
              {panelInRow && selected === ALL_GROUPS && (
                <AllGroupsPanel
                  data={data}
                  caretPercent={caretPercent}
                  onSelect={select}
                  onClose={() => select(ALL_GROUPS)}
                />
              )}
              {panelGroup && (
                <ServicePanel
                  group={panelGroup}
                  periodDays={data.periodDays}
                  caretPercent={caretPercent}
                  bar={data.bar}
                  from={data.barsFrom}
                  to={data.barsTo}
                  onClose={() => select(panelGroup.id)}
                />
              )}
            </Fragment>
          )
        })}
      </div>

      <PeriodList data={data} selected={selected === ALL_GROUPS ? null : selected} onSelect={select} defaultPeriodDays={defaultPeriodDays} />
    </section>
  )
}

/** „3 Dienste · 1 betroffen“ */
function serviceMeta(group: LagebildGroup): string {
  const affected = group.services.filter(
    (service) => service.status === 'degraded' || service.status === 'partial' || service.status === 'major',
  ).length
  const count = group.services.length
  return [
    count === 1 ? t('lagebild.servicesOne') : tf('lagebild.servicesMany', { count }),
    affected > 0 ? tf('lagebild.affected', { count: affected }) : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** „5 Gruppen · 1 betroffen“ */
function groupsMeta(groups: LagebildGroup[]): string {
  const affected = groups.filter(
    (group) => group.status === 'degraded' || group.status === 'partial' || group.status === 'major',
  ).length
  return [
    groups.length === 1 ? t('lagebild.groupsOne') : tf('lagebild.groupsMany', { count: groups.length }),
    affected > 0 ? tf('lagebild.affected', { count: affected }) : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Symbol der Gruppe, bei der Kachel „Alle“ der Text „ALLE“. */
function TileIcon({ tile, className }: { tile: TileModel; className: string }) {
  if (tile.icon !== null) return <GroupIcon name={tile.icon} className={className} />
  return <span className={cn('text-xs font-bold uppercase leading-none', className)}>{tile.name}</span>
}

function TileA({ tile, active, onSelect }: { tile: TileModel; active: boolean; onSelect: () => void }) {
  const Badge = statusBadgeIcon[tile.status]
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-expanded={active}
      data-testid={tile.icon === null ? 'lagebild-tile-all' : undefined}
      className={cn(
        'relative flex flex-col items-center gap-1 rounded-xl border bg-card px-3 pb-3.5 pt-5 text-center transition-colors hover:bg-secondary/60',
        active ? cn('ring-2 ring-primary/20', statusBorder[tile.status]) : 'border-border',
      )}
    >
      <ChevronDown
        aria-hidden="true"
        className={cn('absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground transition-transform', active && 'rotate-180')}
      />
      <span className={cn('relative mb-2 flex h-14 w-14 items-center justify-center rounded-2xl', statusSoftBg[tile.status])}>
        <TileIcon tile={tile} className={cn('h-7 w-7', statusText[tile.status])} />
        <span className="absolute -bottom-2 -right-2 rounded-full bg-card">
          <Badge className={cn('h-5 w-5', statusText[tile.status])} aria-hidden="true" />
        </span>
      </span>
      <span className="text-sm font-semibold text-foreground">{tile.name}</span>
      <span className={cn('text-xs font-semibold', statusText[tile.status])}>{statusLabel(tile.status)}</span>
      <span className="text-xs text-muted-foreground">{tile.meta}</span>
    </button>
  )
}

/** Dienste einer Gruppe: Balken der letzten 12 Stunden und Verfügbarkeit im gewählten Zeitraum. */
function ServicePanel({
  group,
  periodDays,
  caretPercent,
  bar,
  from,
  to,
  onClose,
}: {
  group: LagebildGroup
  periodDays: PeriodDays
  caretPercent: number
  bar: LagebildData['bar']
  from: string
  to: string
  onClose: () => void
}) {
  const periodName = t(`lagebild.period.${periodDays}` as const)
  return (
    <div
      role="region"
      aria-label={tf('lagebild.servicesOf', { group: group.name })}
      data-testid={`lagebild-panel-${group.id}`}
      className={cn(
        'relative col-span-full animate-fade-in space-y-3 rounded-xl border bg-card p-4',
        statusBorder[group.status],
      )}
    >
      <span
        aria-hidden="true"
        style={{ left: `${caretPercent}%` }}
        className={cn(
          'absolute -top-[7px] h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t bg-card',
          statusBorder[group.status],
        )}
      />
      <div className="flex items-center gap-3">
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', statusSoftBg[group.status])}>
          <GroupIcon name={group.icon} className={cn('h-[18px] w-[18px]', statusText[group.status])} />
        </span>
        <h3 className="flex-1 text-base font-bold text-foreground">{group.name}</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary/60"
        >
          {t('lagebild.close')}
        </button>
      </div>

      <div>
        <div className="hidden grid-cols-[minmax(8rem,12rem)_minmax(0,1fr)_5.5rem] items-end gap-4 pb-1.5 text-[11px] text-muted-foreground sm:grid">
          <span>{t('lagebild.colService')}</span>
          <span className="flex flex-col gap-0.5">
            <span>{tf('lagebild.colBar', { hours: (bar.slots * bar.slotMinutes) / 60, minutes: bar.slotMinutes })}</span>
            <span className="flex justify-between text-xs font-semibold tabular-nums text-foreground">
              <span>{from}</span>
              <span>{to}</span>
            </span>
          </span>
          <span className="text-right">{t('lagebild.colAvailability')}</span>
        </div>
        <div className="flex justify-between pb-1.5 text-xs font-semibold tabular-nums text-foreground sm:hidden">
          <span>{from}</span>
          <span>{to}</span>
        </div>
        <ul>
          {group.services.map((service) => (
            <li
              key={service.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 border-t border-border py-2.5 sm:grid-cols-[minmax(8rem,12rem)_minmax(0,1fr)_5.5rem]"
            >
              <span className="min-w-0">
                <span className="block break-words text-sm font-semibold text-foreground">{service.name}</span>
                <span className={cn('block text-xs font-semibold', statusText[service.status])}>
                  {statusLabel(service.status)}
                </span>
              </span>
              <span className="order-last col-span-2 sm:order-none sm:col-span-1">
                <StatusBar
                  runs={service.bars}
                  window={bar}
                  heightClass="h-5"
                  label={`${service.name}: ${statusLabel(service.status)}`}
                />
              </span>
              <span className="text-right text-sm font-semibold tabular-nums text-foreground">
                {service.availabilityLabel || '–'}
                <span className="block text-[11px] font-normal text-muted-foreground">
                  {service.availabilitySince || periodName}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <BarLegend />
    </div>
  )
}

function TileB({
  tile,
  active,
  onSelect,
  bar,
  from,
  to,
}: {
  tile: TileModel
  active: boolean
  onSelect: () => void
  bar: LagebildData['bar']
  from: string
  to: string
}) {
  const Badge = statusBadgeIcon[tile.status]
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-expanded={active}
      data-testid={tile.icon === null ? 'lagebild-tile-all' : undefined}
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-l-4 bg-card px-4 py-3 text-left transition-colors hover:bg-secondary/60',
        statusBorder[tile.status],
        active && 'ring-2 ring-primary/30',
      )}
    >
      <span className="flex items-center gap-3">
        <TileIcon tile={tile} className="h-6 w-6 shrink-0 text-muted-foreground" />
        <span className="flex-1">
          <span className="block text-sm font-semibold text-foreground">{tile.name}</span>
          <span className="block text-xs text-muted-foreground">
            <span className={cn('font-semibold', statusText[tile.status])}>{statusLabel(tile.status)}</span>
            {' · '}
            {tile.meta}
          </span>
        </span>
        <Badge className={cn('h-5 w-5 shrink-0', statusText[tile.status])} aria-hidden="true" />
        <ChevronDown
          aria-hidden="true"
          className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', active && 'rotate-180')}
        />
      </span>
      <span className="block">
        <StatusBar runs={tile.bars} window={bar} heightClass="h-3" label={`${tile.name}: ${statusLabel(tile.status)}`} />
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
  defaultPeriodDays,
}: {
  data: LagebildData
  selected: string | null
  onSelect: (groupId: string | null) => void
  defaultPeriodDays: PeriodDays
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  /** Rückschau über die Adresse wechseln, damit der Server neu rechnet. Die Vorgabe des Admins erscheint nicht in der Adresse. */
  function changePeriod(days: PeriodDays) {
    const url = new URL(window.location.href)
    if (days === defaultPeriodDays) url.searchParams.delete('rueckschau')
    else url.searchParams.set('rueckschau', String(days))
    startTransition(() => router.replace(`${url.pathname}${url.search}`, { scroll: false }))
  }

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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-foreground">
          {tf('lagebild.periodsTitle', { days: data.periodDays })}
        </h3>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t('lagebild.periodLabel')}
          <select
            value={data.periodDays}
            disabled={pending}
            onChange={(event) => changePeriod(Number(event.target.value) as PeriodDays)}
            data-testid="lagebild-period"
            className="rounded-md border border-border bg-card px-2 py-1 text-sm font-medium text-foreground"
          >
            {PERIOD_OPTIONS.map((days) => (
              <option key={days} value={days}>
                {t(`lagebild.period.${days}` as const)}
              </option>
            ))}
          </select>
        </label>
      </div>

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
