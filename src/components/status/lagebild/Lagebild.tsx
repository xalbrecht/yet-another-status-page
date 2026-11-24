'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, LayoutGrid, Wrench } from 'lucide-react'
import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, useTransition, type ReactNode } from 'react'
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
import { useTranslation } from '@/lib/i18n/client'
import type { Translate, TranslateFormat } from '@/lib/i18n/core'
import { cn } from '@/lib/utils'
import { AllGroupsPanel } from './AllGroupsPanel'
import { BarLegend } from './BarLegend'
import { GroupIcon } from './GroupIcon'
import { GroupTooltip, useDelayedHover } from './GroupTooltip'
import { caretPosition, panelFollowsTile } from './panel-placement'
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
  /** Zeilen des Tooltips: Dienste der Gruppe, bei „Alle“ die Gruppen, die nicht betriebsbereit sind */
  tipItems: Array<{ name: string; status: LagebildStatus }>
  tipFooter?: string
}

type Props = {
  variant: Variant
  data: LagebildData
  /** Gruppe aus der Adresse (`?gruppe=…`), falls vorhanden */
  initialGroup: string | null
  /** Vorgabe des Admins für die Rückschau */
  defaultPeriodDays: PeriodDays
  /** Vorgabe des Admins für den Zeitraum des Balkens */
  defaultBarHours: BarHours
  /** Hinweis zu laufender oder bevorstehender Wartung je Dienst-Id. Kommt nicht aus dem Zwischenspeicher, sondern je Aufruf. */
  maintenanceNotices?: Record<string, string>
}

/** Lagebild je Dienstgruppe: Kacheln mit aufklappbaren Diensten, Einschränkungen der gewählten Rückschau. */
export function Lagebild({ variant, data, initialGroup, defaultPeriodDays, defaultBarHours, maintenanceNotices = {} }: Props) {
  if (data.groups.length === 0) return null

  return (
    <LagebildView
      variant={variant}
      data={data}
      initialGroup={initialGroup}
      defaultPeriodDays={defaultPeriodDays}
      defaultBarHours={defaultBarHours}
      maintenanceNotices={maintenanceNotices}
    />
  )
}

function LagebildView({
  variant,
  data,
  initialGroup,
  defaultPeriodDays,
  defaultBarHours,
  maintenanceNotices,
}: {
  variant: Variant
  data: LagebildData
  initialGroup: string | null
  defaultPeriodDays: PeriodDays
  defaultBarHours: BarHours
  maintenanceNotices: Record<string, string>
}) {
  const { t, tf } = useTranslation()
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

  const allTile: TileModel = {
    id: ALL_GROUPS,
    name: t('lagebild.allGroups'),
    status: worstStatus(data.groups.map((group) => group.status)) ?? 'operational',
    meta: groupsMeta(data.groups, t, tf),
    bars: data.allBars,
    icon: null,
    ...allTooltip(data.groups, t, tf),
  }
  const groupTiles: TileModel[] = data.groups.map((group) => ({
    id: group.id,
    name: group.name,
    status: group.status,
    meta: serviceMeta(group, t, tf),
    bars: group.bars,
    icon: group.icon,
    tipItems: group.services.map((service) => ({ name: service.name, status: service.status })),
  }))

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
    const url = new URL(window.location.href)
    if (next && next !== ALL_GROUPS) url.searchParams.set('gruppe', next)
    else url.searchParams.delete('gruppe')
    window.history.replaceState(null, '', url)
  }

  return (
    <section className="animate-fade-in" data-testid={`lagebild-${variant}`} data-lagebild-bounds>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-foreground">
          {t('lagebild.title')}
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

      <div className="space-y-3" data-testid="lagebild-all">
        {variant === 'a' ? (
          <TileA tile={allTile} wide active={selected === ALL_GROUPS} onSelect={() => select(ALL_GROUPS)} />
        ) : (
          <TileB tile={allTile} wide active={selected === ALL_GROUPS} onSelect={() => select(ALL_GROUPS)} bar={data.bar} from={data.barsFrom} to={data.barsTo} />
        )}
        {selected === ALL_GROUPS && (
          <AllGroupsPanel data={data} caretPercent={50} onSelect={select} onClose={() => select(ALL_GROUPS)} />
        )}
      </div>

      <h3 className="mb-3 mt-5 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground after:h-px after:flex-1 after:bg-border">
        {t('lagebild.groupsHeading')}
      </h3>

      <div
        ref={gridRef}
        data-lagebild-grid
        className={cn(
          'grid gap-3',
          variant === 'a' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2',
        )}
      >
        {groupTiles.map((tile, index) => {
          const open = selected === tile.id
          const selectedIndex = groupTiles.findIndex((candidate) => candidate.id === selected)
          // Aufklappbereich steht hinter der letzten Kachel der Zeile
          const panelGroup = panelFollowsTile(index, groupTiles.length, columns, selectedIndex)
            ? data.groups[selectedIndex]
            : undefined
          return (
            <Fragment key={tile.id}>
              {variant === 'a' ? (
                <TileA tile={tile} active={open} onSelect={() => select(tile.id)} />
              ) : (
                <TileB tile={tile} active={open} onSelect={() => select(tile.id)} bar={data.bar} from={data.barsFrom} to={data.barsTo} />
              )}
              {panelGroup && (
                <ServicePanel
                  group={panelGroup}
                  maintenanceNotices={maintenanceNotices}
                  periodDays={data.periodDays}
                  caretPercent={caretPosition(selectedIndex, columns)}
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
function serviceMeta(group: LagebildGroup, t: Translate, tf: TranslateFormat): string {
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

/** Tooltip der Kachel „Alle“: Gruppen, die nicht betriebsbereit sind, und die Zahl der übrigen. */
function allTooltip(groups: LagebildGroup[], t: Translate, tf: TranslateFormat): Pick<TileModel, 'tipItems' | 'tipFooter'> {
  const affected = groups.filter((group) => group.status !== 'operational')
  const rest = groups.length - affected.length
  return {
    tipItems: affected.map((group) => ({ name: group.name, status: group.status })),
    tipFooter:
      rest === 0
        ? undefined
        : affected.length === 0
          ? t('lagebild.tipAllOk')
          : rest === 1
            ? t('lagebild.tipOthersOne')
            : tf('lagebild.tipOthers', { count: rest }),
  }
}

type TileButtonProps = {
  onClick: () => void
  onPointerDown: (event: React.PointerEvent) => void
  onFocus: (event: React.FocusEvent<HTMLElement>) => void
  onBlur: () => void
  onKeyDown: (event: React.KeyboardEvent) => void
  'aria-describedby': string
}

/**
 * Rahmen einer Kachel mit Tooltip. Maus: Tooltip beim Darüberfahren, Klick wählt. Tastatur: Fokus zeigt ihn, Esc schließt.
 * Touch: das erste Tippen zeigt den Tooltip, das zweite wählt. Ein Tippen daneben schließt ihn.
 * Geöffnet wird erst bei einer echten Mausbewegung (`pointermove`), nicht beim bloßen Eintritt: Verschiebt sich das
 * Layout unter der ruhenden Maus (Dienstfeld klappt auf, Seite scrollt), erzeugt der Browser Eintrittsereignisse ohne
 * Bewegung, und fremde Tooltips würden aufgehen.
 * Nach einem Mausklick bleibt der Tooltip geschlossen, bis die Maus die Kachel verlassen hat: Sonst öffnet schon eine
 * kleine Bewegung über dem gerade geöffneten Dienstfeld ihn erneut. Der Tooltip ist ein Kind des Rahmens, die Ereignisse
 * `pointermove` und `pointerleave` des Rahmens gelten daher auch über dem Tooltip.
 */
function TileFrame({
  tile,
  onSelect,
  children,
}: {
  tile: TileModel
  onSelect: () => void
  children: (props: TileButtonProps) => ReactNode
}) {
  const tipId = useId()
  const frame = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('mouse')
  const { open, enter, leave, close } = useDelayedHover()
  // Gesetzt nach einem Mausklick, zurückgenommen beim Verlassen der Kachel
  const [reopenBlocked, setReopenBlocked] = useState(false)

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!frame.current?.contains(event.target as Node)) close()
    }
    // Esc schließt auch einen Tooltip, der nur per Maus geöffnet wurde (WCAG 1.4.13)
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open, close])

  const activate = () => {
    if (input === 'mouse') setReopenBlocked(true)
    close()
    onSelect()
  }

  return (
    <div
      ref={frame}
      data-testid={`lagebild-tile-${tile.id === ALL_GROUPS ? 'all' : tile.id}`}
      onPointerMove={(event) => event.pointerType !== 'touch' && !reopenBlocked && enter()}
      onPointerLeave={(event) => {
        if (event.pointerType === 'touch') return
        setReopenBlocked(false)
        leave()
      }}
      className={cn('relative flex', open && 'z-20')}
    >
      {children({
        onClick: () => (input === 'touch' && !open ? enter() : activate()),
        onPointerDown: (event) => setInput(event.pointerType),
        onFocus: (event) => {
          if (event.currentTarget.matches(':focus-visible')) enter()
        },
        onBlur: leave,
        onKeyDown: (event) => {
          setInput('keyboard')
          if (event.key === 'Escape') close()
        },
        'aria-describedby': tipId,
      })}
      <GroupTooltip
        id={tipId}
        title={tile.name}
        items={tile.tipItems}
        footer={tile.tipFooter}
        open={open}
        onActivate={activate}
      />
    </div>
  )
}

/** „5 Gruppen · 1 betroffen“ */
function groupsMeta(groups: LagebildGroup[], t: Translate, tf: TranslateFormat): string {
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

/** Symbol der Gruppe, bei der Kachel „Alle“ ein Raster aus vier Quadraten. */
function TileIcon({ tile, className }: { tile: TileModel; className: string }) {
  if (tile.icon !== null) return <GroupIcon name={tile.icon} className={className} />
  return <LayoutGrid aria-hidden="true" className={className} />
}

/** `wide`: die Kachel „Alle“ in eigener Zeile, waagerecht mit Symbol links und Pfeil rechts. */
function TileA({ tile, active, onSelect, wide = false }: { tile: TileModel; active: boolean; onSelect: () => void; wide?: boolean }) {
  const { t } = useTranslation()
  const Badge = statusBadgeIcon[tile.status]
  return (
    <TileFrame tile={tile} onSelect={onSelect}>
      {(buttonProps) => (
        <button
          type="button"
          {...buttonProps}
          aria-expanded={active}
          className={cn(
            'relative flex w-full rounded-xl border bg-card transition-colors hover:bg-secondary/60',
            wide
              ? 'items-center gap-3.5 border-l-4 px-4 py-3.5 text-left'
              : 'flex-col items-center gap-1 px-3 pb-3.5 pt-5 text-center',
            wide ? statusBorder[tile.status] : active ? cn('ring-2 ring-primary/20', statusBorder[tile.status]) : 'border-border',
            wide && active && 'ring-2 ring-primary/20',
          )}
        >
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              wide ? 'order-last shrink-0' : 'absolute right-2.5 top-2.5',
              active && 'rotate-180',
            )}
          />
          <span className={cn('relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl', !wide && 'mb-2', statusSoftBg[tile.status])}>
            <TileIcon tile={tile} className={cn('h-7 w-7', statusText[tile.status])} />
            <span className="absolute -bottom-2 -right-2 rounded-full bg-card">
              <Badge className={cn('h-5 w-5', statusText[tile.status])} aria-hidden="true" />
            </span>
          </span>
          {wide ? (
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="text-base font-semibold text-foreground">{tile.name}</span>
              <span className="text-xs text-muted-foreground">
                <span className={cn('font-semibold', statusText[tile.status])}>{statusLabel(tile.status, t)}</span>
                {' · '}
                {tile.meta}
              </span>
            </span>
          ) : (
            <>
              <span className="text-sm font-semibold text-foreground">{tile.name}</span>
              <span className={cn('text-xs font-semibold', statusText[tile.status])}>{statusLabel(tile.status, t)}</span>
              <span className="text-xs text-muted-foreground">{tile.meta}</span>
            </>
          )}
        </button>
      )}
    </TileFrame>
  )
}

/** Dienste einer Gruppe: Balken der letzten 12 Stunden und Verfügbarkeit im gewählten Zeitraum. */
function ServicePanel({
  group,
  maintenanceNotices,
  periodDays,
  caretPercent,
  bar,
  from,
  to,
  onClose,
}: {
  group: LagebildGroup
  maintenanceNotices: Record<string, string>
  periodDays: PeriodDays
  caretPercent: number
  bar: LagebildData['bar']
  from: string
  to: string
  onClose: () => void
}) {
  const { t, tf } = useTranslation()
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
        <h4 className="flex-1 text-base font-bold text-foreground">{group.name}</h4>
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
                  {statusLabel(service.status, t)}
                </span>
                {maintenanceNotices[service.id] && (
                  <span
                    data-testid="service-maintenance"
                    className="mt-0.5 flex items-start gap-1 text-xs text-status-maintenance"
                  >
                    <Wrench className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 break-words">{maintenanceNotices[service.id]}</span>
                  </span>
                )}
              </span>
              <span className="order-last col-span-2 sm:order-none sm:col-span-1">
                <StatusBar
                  runs={service.bars}
                  window={bar}
                  heightClass="h-5"
                  label={`${service.name}: ${statusLabel(service.status, t)}`}
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

/** `wide`: die Kachel „Alle“ in eigener Zeile, der Balken steht rechts, auf schmalen Geräten darunter. */
function TileB({
  tile,
  active,
  onSelect,
  bar,
  from,
  to,
  wide = false,
}: {
  tile: TileModel
  active: boolean
  onSelect: () => void
  wide?: boolean
  bar: LagebildData['bar']
  from: string
  to: string
}) {
  const { t } = useTranslation()
  const Badge = statusBadgeIcon[tile.status]
  return (
    <TileFrame tile={tile} onSelect={onSelect}>
      {(buttonProps) => (
        <button
          type="button"
          {...buttonProps}
          aria-expanded={active}
          className={cn(
            'flex w-full flex-col gap-3 rounded-lg border border-l-4 bg-card px-4 py-3 text-left transition-colors hover:bg-secondary/60',
            statusBorder[tile.status],
            active && 'ring-2 ring-primary/30',
          )}
        >
          <span className={cn('flex items-center gap-3', wide && 'md:gap-4')}>
            <TileIcon tile={tile} className={cn('shrink-0 text-muted-foreground', wide ? 'h-7 w-7' : 'h-6 w-6')} />
            <span className="flex-1">
              <span className={cn('block font-semibold text-foreground', wide ? 'text-base' : 'text-sm')}>{tile.name}</span>
              <span className="block text-xs text-muted-foreground">
                <span className={cn('font-semibold', statusText[tile.status])}>{statusLabel(tile.status, t)}</span>
                {' · '}
                {tile.meta}
              </span>
            </span>
            {wide && (
              <span className="hidden min-w-0 md:block md:flex-[1.3]">
                <TileBar tile={tile} bar={bar} from={from} to={to} />
              </span>
            )}
            <Badge className={cn('h-5 w-5 shrink-0', statusText[tile.status])} aria-hidden="true" />
            <ChevronDown
              aria-hidden="true"
              className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', active && 'rotate-180')}
            />
          </span>
          <span className={cn('block', wide && 'md:hidden')}>
            <TileBar tile={tile} bar={bar} from={from} to={to} />
          </span>
        </button>
      )}
    </TileFrame>
  )
}

/** Balken der letzten Stunden mit Zeitangabe an beiden Enden. */
function TileBar({ tile, bar, from, to }: { tile: TileModel; bar: LagebildData['bar']; from: string; to: string }) {
  const { t } = useTranslation()
  return (
    <span className="block">
      <StatusBar runs={tile.bars} window={bar} heightClass="h-3" label={`${tile.name}: ${statusLabel(tile.status, t)}`} />
      <span className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{from}</span>
        <span>{to}</span>
      </span>
    </span>
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
  const { t, tf } = useTranslation()
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
                      {statusLabel(period.status, t)}
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
