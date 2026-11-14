'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { statusLabel, type LagebildStatus } from '@/lib/lagebild'
import { cn } from '@/lib/utils'
import { statusBg } from './status-styles'

/** Größte Breite des Tooltips in Pixeln. Im schmalen Raster ist er 24 Pixel schmaler als das Raster. */
const MAX_WIDTH = 340

/**
 * Öffnet und schließt mit Verzögerung. `enter` öffnet sofort, `leave` schließt nach `delayMs`, damit die Maus von der
 * Kachel in den Tooltip wechseln kann. `close` schließt sofort (Escape, Auswahl, Tippen daneben).
 */
export function useDelayedHover(delayMs = 250): { open: boolean; enter: () => void; leave: () => void; close: () => void } {
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const clear = useCallback(() => {
    if (timer.current !== undefined) clearTimeout(timer.current)
    timer.current = undefined
  }, [])
  const enter = useCallback(() => {
    clear()
    setOpen(true)
  }, [clear])
  const leave = useCallback(() => {
    clear()
    timer.current = setTimeout(() => setOpen(false), delayMs)
  }, [clear, delayMs])
  const close = useCallback(() => {
    clear()
    setOpen(false)
  }, [clear])
  useEffect(() => clear, [clear])

  return { open, enter, leave, close }
}

type Props = {
  id: string
  title: string
  items: Array<{ name: string; status: LagebildStatus }>
  /** Zeile unter der Liste, z. B. „9 weitere Gruppen betriebsbereit“ */
  footer?: string
  open: boolean
  onEnter: () => void
  onLeave: () => void
  onActivate: () => void
}

/**
 * Dienste einer Gruppe mit farbigem Punkt, ohne Beschreibung. Die Liste steht immer im Markup, damit `aria-describedby`
 * der Kachel sie auch geschlossen vorlesen kann; angezeigt wird sie nur bei `open`. Der Zustand steht zusätzlich als Text
 * für Screenreader da. Der Tooltip überlappt den unteren Rand der Kachel um 4 Pixel, damit die Maus keine Lücke quert,
 * und bleibt innerhalb des Rasters (`data-lagebild-grid`).
 */
export function GroupTooltip({ id, title, items, footer, open, onEnter, onLeave, onActivate }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState({ width: MAX_WIDTH, shift: 0 })

  useLayoutEffect(() => {
    if (!open) return
    const element = ref.current
    const grid = element?.closest('[data-lagebild-grid]')
    const anchor = element?.offsetParent
    if (!element || !grid || !anchor) return
    const gridBox = grid.getBoundingClientRect()
    const anchorBox = anchor.getBoundingClientRect()
    const width = Math.max(0, Math.min(MAX_WIDTH, gridBox.width - 24))
    const left = Math.min(Math.max(anchorBox.left, gridBox.left), gridBox.right - width)
    setPlace({ width, shift: left - anchorBox.left })
  }, [open])

  return (
    <div
      ref={ref}
      id={id}
      role="tooltip"
      data-open={open ? 'true' : 'false'}
      onPointerMove={(event) => event.pointerType !== 'touch' && onEnter()}
      onPointerLeave={(event) => event.pointerType !== 'touch' && onLeave()}
      onClick={onActivate}
      style={{ left: place.shift, width: place.width }}
      className={cn(
        'absolute top-[calc(100%-4px)] z-30 cursor-pointer rounded-lg border border-border bg-card p-3 text-left shadow-lg',
        // Geschlossen ohne Box (display: none): Auch unsichtbare Boxen verbreitern sonst die Seite am Rand des Rasters.
        // `aria-describedby` der Kachel löst den Inhalt trotzdem auf.
        open ? 'block' : 'hidden',
      )}
    >
      <p className="mb-1.5 text-xs font-semibold text-foreground">{title}</p>
      <ul className="space-y-1">
        {items.map((item, index) => (
          <li key={`${item.name}-${index}`} className="flex items-center gap-2 text-xs text-foreground">
            <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full', statusBg[item.status])} />
            <span className="min-w-0 break-words">{item.name}</span>
            <span className="sr-only">{statusLabel(item.status)}</span>
          </li>
        ))}
      </ul>
      {footer && <p className="mt-1.5 text-[11px] text-muted-foreground">{footer}</p>}
    </div>
  )
}
