'use client'

import { startTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/client'
import {
  AUTO_REFRESH_MIN_DELAY_MS,
  AUTO_REFRESH_PAUSE_ATTRIBUTE,
  isRefreshPaused,
  refreshDelayMs,
  type AutoRefreshProps,
} from '@/lib/auto-refresh'

/** Wartezeit, bis eine pausierte Seite erneut prüft, ob sie neu laden darf. */
const PAUSE_RECHECK_MS = AUTO_REFRESH_MIN_DELAY_MS
/** Streuung hinter dem Ablauf des Zwischenspeichers, damit nicht alle Besucher im selben Moment anfragen. */
const MAX_JITTER_MS = 3_000
/** Ablauf des Zwischenspeichers plus Rest: Der erste Aufruf danach rechnet neu (`timed-cache.ts` gilt bis einschließlich der Dauer). */
const BASE_MARGIN_MS = 1_000

function paused(): boolean {
  const active = document.activeElement
  return isRefreshPaused({
    hidden: document.hidden,
    dialogOpen: document.querySelector(`[${AUTO_REFRESH_PAUSE_ATTRIBUTE}]`) !== null,
    focusedTag: active?.tagName ?? '',
    focusedEditable: active instanceof HTMLElement && active.isContentEditable,
  })
}

/**
 * Zeile in der Fußzeile („Stand 10:42 · aktualisiert sich alle 5 Minuten“) und Zeitgeber für das Neuladen (Issue #288).
 *
 * Der Server liefert das Alter des Stands, nicht seine Uhrzeit: Die Uhr des Browsers kann abweichen. Das Neuladen
 * trifft das Ende der Zwischenspeicher-Zeit, deshalb zeigt die neue Seite einen neuen Stand. Es pausiert, solange der Tab
 * nicht sichtbar ist, ein Fenster offen ist oder ein Eingabefeld Fokus hat, und holt beim Sichtbarwerden nach.
 */
export function AutoRefresh({ minutes, ageMs, standLabel }: AutoRefreshProps) {
  const { tf } = useTranslation()
  const router = useRouter()
  const deadline = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const clear = () => {
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = null
    }
    const refresh = () => startTransition(() => router.refresh())
    const schedule = (delay: number) => {
      clear()
      deadline.current = performance.now() + delay
      timer.current = setTimeout(tick, delay)
    }
    function tick() {
      if (paused()) return schedule(PAUSE_RECHECK_MS)
      refresh()
      // Kommt kein neuer Stand an (Fehler, anderer Zwischenspeicher), versucht es nach einem vollen Intervall erneut
      schedule(minutes * 60_000)
    }
    const onVisible = () => {
      if (!document.hidden && performance.now() >= deadline.current) tick()
    }

    schedule(refreshDelayMs({ ageMs, minutes, marginMs: BASE_MARGIN_MS + Math.random() * MAX_JITTER_MS }))
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clear()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [router, minutes, ageMs, standLabel])

  const every = minutes === 1 ? tf('footer.autoRefreshOne', { time: standLabel }) : tf('footer.autoRefreshMany', { time: standLabel, minutes: String(minutes) })
  return (
    <p className="text-xs text-muted-foreground/80" data-testid="auto-refresh">
      {every}
    </p>
  )
}
