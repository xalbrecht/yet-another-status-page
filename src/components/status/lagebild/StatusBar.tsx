'use client'

import { useEffect, useMemo, useState } from 'react'
import type { BarRun, BarWindow } from '@/lib/lagebild'
import { statusLabel } from '@/lib/lagebild'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { statusBg } from './status-styles'

type Props = {
  runs: BarRun[]
  /** Zeitfenster des Balkens, daraus ergibt sich die Uhrzeit eines Strichs */
  window: BarWindow & { locale: string; timeZone: string; yesterday: string }
  heightClass?: string
  label: string
}

/**
 * Balken aus einem Strich je Abschnitt (5 Minuten bei 12 Stunden). Der Tooltip nennt das Ende des Abschnitts
 * („12:05“) und den Zustand. Er erscheint bei Maus und Antippen und verschwindet beim Scrollen.
 */
export function StatusBar({ runs, window: bar, heightClass = 'h-6', label }: Props) {
  const [tip, setTip] = useState<{ index: number; x: number; y: number } | null>(null)

  // Ein Formatierer je Balken, nicht je Strich
  const clock = useMemo(
    () => new Intl.DateTimeFormat(bar.locale, { hour: '2-digit', minute: '2-digit', timeZone: bar.timeZone }),
    [bar.locale, bar.timeZone],
  )

  // Kalendertag in der Zeitzone der Statusseite, für „gestern“ vor der Uhrzeit
  const day = useMemo(() => new Intl.DateTimeFormat('en-CA', { timeZone: bar.timeZone }), [bar.timeZone])

  useEffect(() => {
    if (!tip) return
    const hide = () => setTip(null)
    globalThis.addEventListener('scroll', hide, true)
    return () => globalThis.removeEventListener('scroll', hide, true)
  }, [tip])

  const slots: Array<BarRun['status']> = []
  for (const run of runs) for (let i = 0; i < run.slots; i++) slots.push(run.status)

  function show(target: EventTarget) {
    const el = (target as HTMLElement).closest?.('[data-i]') as HTMLElement | null
    if (!el) return setTip(null)
    const rect = el.getBoundingClientRect()
    // Tooltip bleibt innerhalb des Fensters
    const x = Math.min(Math.max(rect.left + rect.width / 2, 40), globalThis.innerWidth - 40)
    setTip({ index: Number(el.dataset.i), x, y: rect.top })
  }

  // Der letzte Abschnitt ist noch nicht zu Ende: sein Tooltip nennt die aktuelle Uhrzeit
  const endOfSlot = tip ? new Date(Math.min(bar.startMs + (tip.index + 1) * bar.slotMinutes * 60_000, bar.nowMs)) : null
  const tipStatus = tip ? slots[tip.index] : null

  return (
    <div
      className={cn('flex w-full gap-px', heightClass)}
      role="img"
      aria-label={label}
      onPointerOver={(event) => show(event.target)}
      onPointerDown={(event) => show(event.target)}
      onPointerLeave={() => setTip(null)}
    >
      {slots.map((status, index) => (
        <span
          key={index}
          data-i={index}
          className={cn('min-w-px flex-1 rounded-[1px] hover:opacity-80', status ? statusBg[status] : 'bg-border')}
        />
      ))}
      {tip && endOfSlot && (
        <span
          role="tooltip"
          style={{ left: tip.x, top: tip.y - 6 }}
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-semibold tabular-nums text-background shadow-md"
        >
          {day.format(endOfSlot) === day.format(bar.nowMs) ? '' : `${bar.yesterday} `}
          {clock.format(endOfSlot)}
          <span className="block text-[11px] font-medium opacity-85">
            {tipStatus ? statusLabel(tipStatus) : t('lagebild.noData')}
          </span>
        </span>
      )}
    </div>
  )
}
