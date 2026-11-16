import React from 'react'
import { useAdminText, type AdminText } from '@/lib/i18n/admin-client'
import { formatDateTime, type DateTimeConfig } from '@/lib/datetime'
import { shortCommit, type SystemInfo } from '@/lib/system-info'

/** Darstellung der Angaben zum laufenden Stand. Reine Komponenten ohne Abruf und ohne Stil-Import, damit sie ohne Browser prüfbar sind. */
export type SystemInfoResponse = SystemInfo & { dateTime: DateTimeConfig }

export const formatter = (info: SystemInfoResponse) => (iso: string) => formatDateTime(new Date(iso), info.dateTime)

/** Zeilen der Karte als Paare aus Bezeichnung und Wert. Fehlende Werte stehen als „unbekannt“ da. */
function rowsOf(info: SystemInfoResponse, ta: AdminText): Array<{ key: string; label: string; value: string }> {
  const format = formatter(info)
  const unknown = ta('unknown')
  const rows: Array<{ key: string; label: string; value: string }> = []
  if (info.image) {
    rows.push(
      { key: 'tag', label: ta('Image tag'), value: info.image.tag ?? unknown },
      { key: 'date', label: ta('Build date'), value: info.image.date ? format(info.image.date) : unknown },
      { key: 'commit', label: ta('Commit'), value: info.image.commit ? shortCommit(info.image.commit) : unknown },
    )
  }
  rows.push(
    { key: 'version', label: ta('Version'), value: `v${info.version}` },
    { key: 'node', label: ta('Node.js'), value: info.node },
    { key: 'started', label: ta('Started'), value: format(info.startedAt) },
    { key: 'container', label: ta('Container'), value: info.container === null ? unknown : info.container ? ta('yes') : ta('no') },
    { key: 'migration', label: ta('Last migration'), value: info.lastMigration ?? unknown },
  )
  return rows
}

/** Darstellung der Karte „System“. Reine Komponente: die Angaben kommen von außen, `failed` zeigt den Hinweis statt der Zeilen. */
export const SystemCardView: React.FC<{ info: SystemInfoResponse | null; failed?: boolean }> = ({ info, failed }) => {
  const ta = useAdminText()
  return (
    <div className="system-card" data-testid="system-card">
      <h2 className="system-card__title">{ta('System')}</h2>
      {failed && <p className="system-card__hint" data-testid="system-card-failed">{ta('System information is not available.')}</p>}
      {info && (
        <>
          {info.image === null && <p className="system-card__hint" data-testid="system-card-no-image">{ta('Development build, no YASP image')}</p>}
          <dl className="system-card__list">
            {rowsOf(info, ta).map((row) => (
              <div key={row.key} className="system-card__row" data-testid={`system-${row.key}`}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  )
}
