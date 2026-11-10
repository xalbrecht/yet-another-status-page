import type { BarRun } from '@/lib/lagebild'
import { statusLabel } from '@/lib/lagebild'
import { t, tf } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { statusBg } from './status-styles'

/** Balken der letzten 12 Stunden. Jeder Abschnitt ist so breit wie sein Zeitraum. */
export function StatusBar({ runs, heightClass = 'h-6', label }: { runs: BarRun[]; heightClass?: string; label: string }) {
  return (
    <div className={cn('flex w-full gap-px overflow-hidden rounded-sm', heightClass)} role="img" aria-label={label}>
      {runs.map((run, index) => {
        const status = run.status ? statusLabel(run.status) : t('lagebild.noData')
        return (
          <div
            key={index}
            style={{ flexGrow: run.slots, flexBasis: 0 }}
            className={cn('min-w-px', run.status ? statusBg[run.status] : 'bg-muted')}
            title={tf('lagebild.barRange', { from: run.from, to: run.to, status })}
          />
        )
      })}
    </div>
  )
}
