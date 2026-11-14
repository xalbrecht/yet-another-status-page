'use client'

import { statusLabel, worstStatus, type LagebildData } from '@/lib/lagebild'
import { t, tf } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { BarLegend } from './BarLegend'
import { GroupIcon } from './GroupIcon'
import { StatusBar } from './StatusBar'
import { statusBorder, statusText } from './status-styles'

const ROW_COLUMNS = 'grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(8rem,12rem)_minmax(0,1fr)_5.5rem]'

/** Kachel „Alle“: eine Zeile je Gruppe mit Balken und Verfügbarkeit der Gruppe. Ein Klick auf eine Zeile wählt die Gruppe. */
export function AllGroupsPanel({
  data,
  onSelect,
  onClose,
  caretPercent = 12.5,
}: {
  data: LagebildData
  onSelect: (groupId: string) => void
  onClose: () => void
  caretPercent?: number
}) {
  const status = worstStatus(data.groups.map((group) => group.status)) ?? 'operational'
  const periodName = t(`lagebild.period.${data.periodDays}` as const)
  return (
    <div
      role="region"
      aria-label={t('lagebild.allGroups')}
      data-testid="lagebild-panel-all"
      className={cn('relative col-span-full animate-fade-in space-y-3 rounded-xl border bg-card p-4', statusBorder[status])}
    >
      <span
        aria-hidden="true"
        style={{ left: `${caretPercent}%` }}
        className={cn('absolute -top-[7px] h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t bg-card', statusBorder[status])}
      />
      <div className="flex items-center gap-3">
        <h3 className="flex-1 text-base font-bold text-foreground">{t('lagebild.allGroups')}</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary/60"
        >
          {t('lagebild.close')}
        </button>
      </div>

      <div>
        <div className={cn('hidden items-end gap-4 pb-1.5 text-[11px] text-muted-foreground sm:grid', ROW_COLUMNS)}>
          <span>{t('lagebild.colGroup')}</span>
          <span className="flex flex-col gap-0.5">
            <span>
              {tf('lagebild.colBar', { hours: (data.bar.slots * data.bar.slotMinutes) / 60, minutes: data.bar.slotMinutes })}
            </span>
            <span className="flex justify-between text-xs font-semibold tabular-nums text-foreground">
              <span>{data.barsFrom}</span>
              <span>{data.barsTo}</span>
            </span>
          </span>
          <span className="text-right">{t('lagebild.colAvailability')}</span>
        </div>
        <div className="flex justify-between pb-1.5 text-xs font-semibold tabular-nums text-foreground sm:hidden">
          <span>{data.barsFrom}</span>
          <span>{data.barsTo}</span>
        </div>
        <ul>
          {data.groups.map((group) => (
            <li key={group.id} className="border-t border-border">
              <button
                type="button"
                onClick={() => onSelect(group.id)}
                data-testid="all-groups-row"
                className={cn('grid w-full items-center gap-x-4 gap-y-1.5 py-2.5 text-left hover:bg-secondary/60', ROW_COLUMNS)}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <GroupIcon name={group.icon} className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-semibold text-foreground">{group.name}</span>
                    <span className={cn('block text-xs font-semibold', statusText[group.status])}>
                      {statusLabel(group.status)}
                    </span>
                  </span>
                </span>
                <span className="order-last col-span-2 sm:order-none sm:col-span-1">
                  <StatusBar
                    runs={group.bars}
                    window={data.bar}
                    heightClass="h-5"
                    label={`${group.name}: ${statusLabel(group.status)}`}
                  />
                </span>
                <span className="text-right text-sm font-semibold tabular-nums text-foreground">
                  {group.availabilityLabel || '–'}
                  <span className="block text-[11px] font-normal text-muted-foreground">{periodName}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <BarLegend />
    </div>
  )
}
