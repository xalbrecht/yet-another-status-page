import { statusLabel } from '@/lib/lagebild'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { statusBg } from './status-styles'

/** Legende der Balken: ein Strich je Zustand und „Keine Daten“. */
export function BarLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      {(['operational', 'degraded', 'partial', 'major', 'maintenance'] as const).map((status) => (
        <span key={status} className="inline-flex items-center gap-1.5">
          <span className={cn('h-3 w-1 rounded-[1px]', statusBg[status])} aria-hidden="true" />
          {statusLabel(status)}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-1 rounded-[1px] bg-border" aria-hidden="true" />
        {t('lagebild.noData')}
      </span>
    </div>
  )
}
