'use client'

import { useEffect, useMemo, useState, type PointerEvent } from 'react'
import type { BarRun, BarWindow } from '@/lib/lagebild'
import { statusLabel } from '@/lib/lagebild'
import { useTranslation } from '@/lib/i18n/client'
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
 * Balken aus Strichen zu je einem Abschnitt (5 Minuten bei 12 Stunden), gezeichnet als ein Element je Zustandsfolge. Der Tooltip nennt das Ende des Abschnitts
 * („12:05“) und den Zustand. Er erscheint bei Maus und Antippen und verschwindet beim Scrollen.
 */
export function StatusBar({ runs, window: bar, heightClass = 'h-6', label }: Props) {
  const { t } = useTranslation()
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

  /** Strich unter dem Zeiger, aus der Position im Balken (nicht aus einem Element je Strich) */
  function show(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0 || slots.length === 0) return setTip(null)
    const index = Math.min(slots.length - 1, Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * slots.length)))
    // Tooltip bleibt innerhalb des Fensters
    const center = rect.left + ((index + 0.5) / slots.length) * rect.width
    const x = Math.min(Math.max(center, 40), globalThis.innerWidth - 40)
    setTip((old) => (old && old.index === index && old.x === x && old.y === rect.top ? old : { index, x, y: rect.top }))
  }

  // Der letzte Abschnitt ist noch nicht zu Ende: sein Tooltip nennt die aktuelle Uhrzeit
  const endOfSlot = tip ? new Date(Math.min(bar.startMs + (tip.index + 1) * bar.slotMinutes * 60_000, bar.nowMs)) : null
  const tipStatus = tip ? slots[tip.index] : null

  return (
    <div
      className={cn('relative flex w-full', heightClass)}
      role="img"
      aria-label={label}
      data-slots={slots.length}
      onPointerMove={show}
      onPointerDown={show}
      onPointerLeave={() => setTip(null)}
    >
      {runs.map((run, index) => (
        <span
          key={index}
          data-run={run.slots}
          // Ein Element je Zustandsfolge. Die Maske lässt hinter jedem Strich 1 px frei, damit die Striche
          // wie bisher einzeln erscheinen. Breite über flex-grow, mindestens 1 px je Strich: Ab 288 px Balkenbreite sind es
          // wie bisher 2 px und mehr, schmalere Spalten (Fenster unter rund 325 px) verbreitern die Seite nicht mehr (Issue #245).
          style={{
            flexGrow: run.slots,
            flexBasis: 0,
            minWidth: run.slots,
            maskImage: 'linear-gradient(to right, #000 calc(100% - 1px), transparent 0)',
            maskSize: `${100 / run.slots}% 100%`,
            WebkitMaskImage: 'linear-gradient(to right, #000 calc(100% - 1px), transparent 0)',
            WebkitMaskSize: `${100 / run.slots}% 100%`,
          }}
          className={run.status ? statusBg[run.status] : 'bg-border'}
        />
      ))}
      {tip && (
        <span
          aria-hidden
          data-testid="bar-hover"
          style={{ left: `${(tip.index / slots.length) * 100}%`, width: `${100 / slots.length}%` }}
          className="pointer-events-none absolute inset-y-0 bg-foreground/20"
        />
      )}
      {tip && endOfSlot && (
        <span
          role="tooltip"
          style={{ left: tip.x, top: tip.y - 6 }}
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-semibold tabular-nums text-background shadow-md"
        >
          {day.format(endOfSlot) === day.format(bar.nowMs) ? '' : `${bar.yesterday} `}
          {clock.format(endOfSlot)}
          <span className="block text-[11px] font-medium opacity-85">
            {tipStatus ? statusLabel(tipStatus, t) : t('lagebild.noData')}
          </span>
        </span>
      )}
    </div>
  )
}
