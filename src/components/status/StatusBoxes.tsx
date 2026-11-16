import Link from 'next/link'
import { statusBorder, statusSoftBg, statusText } from '@/components/status/lagebild/status-styles'
import type { Translate, TranslateFormat } from '@/lib/i18n/core'
import { limitBoxItems, type BoxContent, type BoxItem } from '@/lib/status-boxes'

type BoxProps = {
  testId: 'box-incidents' | 'box-maintenances'
  title: string
  /** Beschriftung der Zahl im Kopf, nur für Screenreader („Anzahl:“) */
  countLabel: string
  empty: string
  moreHref: string
  items: BoxItem[]
  entries: number
  content: BoxContent
  tf: TranslateFormat
}

function Box({ testId, title, countLabel, empty, moreHref, items, entries, content, tf }: BoxProps) {
  const { shown, more } = limitBoxItems(items, entries)
  return (
    <section data-testid={testId} className="overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span
          className={`rounded-full px-2 text-xs font-medium ${items.length > 0 ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
        >
          <span className="sr-only">{countLabel} </span>
          {items.length}
        </span>
      </header>
      {shown.length === 0 ? (
        <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul>
          {shown.map((item) => (
            <li
              key={item.id}
              data-testid="box-item"
              className={`flex flex-col gap-1 border-l-4 border-t border-t-border px-4 ${content === 'compact' ? 'py-2' : 'py-3'} ${statusBorder[item.status]}`}
            >
              <div className="flex items-start justify-between gap-2">
                <Link href={item.href} className="text-sm font-semibold hover:underline">
                  {item.title}
                </Link>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusSoftBg[item.status]} ${statusText[item.status]}`}
                >
                  {item.stateLabel}
                </span>
              </div>
              {item.when && <p className="text-xs text-muted-foreground">{item.when}</p>}
              {content === 'full' && item.services.length > 0 && (
                <ul className="flex flex-wrap gap-1">
                  {item.services.map((name, index) => (
                    <li
                      key={`${index}-${name}`}
                      data-testid="box-service"
                      className="rounded-full border border-border bg-background px-2 text-[11px]"
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              )}
              {content === 'full' && item.last && <p className="text-xs">{item.last}</p>}
            </li>
          ))}
        </ul>
      )}
      {more > 0 && (
        <a
          data-testid="box-more"
          href={moreHref}
          className="block border-t border-border px-4 py-2 text-xs font-medium text-primary hover:underline"
        >
          {tf('statusBoxes.more', { count: more })}
        </a>
      )}
    </section>
  )
}

/** Kurzform der offenen Störungen und der Wartungen neben dem Lagebild. */
export function StatusBoxes({
  incidents,
  maintenances,
  entries,
  content,
  t,
  tf,
}: {
  incidents: BoxItem[]
  maintenances: BoxItem[]
  entries: number
  content: BoxContent
  t: Translate
  tf: TranslateFormat
}) {
  const incidentsTitle = t('statusBoxes.incidentsTitle')
  const maintenancesTitle = t('statusBoxes.maintenancesTitle')
  const countLabel = t('statusBoxes.countLabel')
  return (
    <aside aria-label={`${incidentsTitle}, ${maintenancesTitle}`} className="flex flex-col gap-4">
      <Box
        testId="box-incidents"
        title={incidentsTitle}
        countLabel={countLabel}
        empty={t('statusBoxes.noIncidents')}
        moreHref="#incidents"
        items={incidents}
        entries={entries}
        content={content}
        tf={tf}
      />
      <Box
        testId="box-maintenances"
        title={maintenancesTitle}
        countLabel={countLabel}
        empty={t('statusBoxes.noMaintenances')}
        moreHref="#maintenance"
        items={maintenances}
        entries={entries}
        content={content}
        tf={tf}
      />
    </aside>
  )
}
