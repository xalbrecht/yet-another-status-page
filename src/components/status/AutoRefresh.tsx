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
/** Wartezeit nach einem Neuladen, das mangels Antwort des Servers ausfiel. */
const RETRY_AFTER_FAILURE_MS = 30_000
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
 * Anzeige in der Kopfzeile („Stand 10:42“, auf Wunsch mit „· aktualisiert sich alle 5 Minuten“) und Zeitgeber für das Neuladen (Issue #288).
 *
 * Der Server liefert das Alter des Stands, nicht seine Uhrzeit: Die Uhr des Browsers kann abweichen. Das Neuladen
 * trifft das Ende der Zwischenspeicher-Zeit, deshalb zeigt die neue Seite einen neuen Stand. Es pausiert, solange der Tab
 * nicht sichtbar ist, ein Fenster offen ist oder ein Eingabefeld Fokus hat, und holt beim Sichtbarwerden nach.
 */
export function AutoRefresh({ minutes, ageMs, standLabel, showInterval }: AutoRefreshProps) {
  const { tf } = useTranslation()
  const router = useRouter()
  const deadline = useRef(0)
  /** Die Frist ist abgelaufen, das Neuladen wartet aber (Pause oder Server nicht erreichbar). */
  const due = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    let busy = false
    const clear = () => {
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = null
    }
    const schedule = (delay: number) => {
      clear()
      deadline.current = performance.now() + delay
      timer.current = setTimeout(attempt, delay)
    }
    /**
     * `router.refresh()` wiederholt bei einem Fehler nicht: Antwortet der Server nicht mit 200 oder fällt das Netz aus,
     * navigiert Next den ganzen Browser und der Besucher sieht eine Fehlerseite ohne Zeitgeber. Deshalb vorher eine billige
     * Anfrage (`/api/health`): Ohne Antwort bleibt der letzte Stand stehen und es folgt ein neuer Versuch.
     */
    async function reload() {
      busy = true
      try {
        const response = await fetch('/api/health', { cache: 'no-store' })
        if (!response.ok) throw new Error(String(response.status))
      } catch {
        busy = false
        if (!cancelled) schedule(RETRY_AFTER_FAILURE_MS)
        return
      }
      busy = false
      if (cancelled) return
      due.current = false
      startTransition(() => router.refresh())
      // Kommt kein neuer Stand an (anderer Zwischenspeicher), versucht es nach einem vollen Intervall erneut
      schedule(minutes * 60_000)
    }
    function attempt() {
      due.current = true
      if (busy) return
      if (paused()) return schedule(PAUSE_RECHECK_MS)
      clear()
      void reload()
    }
    const onVisible = () => {
      if (!document.hidden && (due.current || performance.now() >= deadline.current)) attempt()
    }

    due.current = false
    schedule(refreshDelayMs({ ageMs, minutes, marginMs: BASE_MARGIN_MS + Math.random() * MAX_JITTER_MS }))
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clear()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [router, minutes, ageMs, standLabel])

  const text = !showInterval
    ? tf('stand.only', { time: standLabel })
    : minutes === 1
      ? tf('stand.everyOne', { time: standLabel })
      : tf('stand.everyMany', { time: standLabel, minutes: String(minutes) })
  return (
    <p className="flex items-center gap-2 text-xs tabular-nums text-muted-foreground" data-testid="auto-refresh">
      <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden="true" />
      {text}
    </p>
  )
}
