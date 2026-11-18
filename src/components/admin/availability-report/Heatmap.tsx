import React from 'react'
import { ta } from '@/lib/i18n/admin'
import { formatAvailability } from '@/lib/availability'
import type { ReportData } from '@/lib/report/aggregate'
import { chunkRows, HEAT_CHUNK_SIZE, heatCellText, heatClass } from '@/lib/report/heat'
import { endedLabel } from '@/lib/report/ended-label'
import type { HeatEndedStyle } from '@/lib/report/display-settings'

/**
 * Wärmekarte: Zeilen mal Monate. Farbstufen Blau, Gelb, Rot (kein Rot-Grün-Paar). Der erste Block (12 Zeilen) steht sofort, jeder weitere ist aufklappbar.
 * Monate ohne Wert (vor dem Beginn, nach dem Ende eines Dienstes) sind schraffiert. Bei `endedStyle` „label“ trägt die Zeile eines
 * beendeten Dienstes zusätzlich eine graue Überschrift mit „beendet am …“, bei „hatch“ nur die Schraffur.
 */

type RowProps = { columns: ReportData['heat']['columns']; target: number; locale: string; timeZone: string; endedStyle: HeatEndedStyle }

function Row(props: RowProps & { row: ReportData['heat']['rows'][number] }) {
  const { row, columns, target, locale, timeZone, endedStyle } = props
  const ended = endedStyle === 'label' && !row.total && row.endedAt != null
  return (
    <tr className={row.total ? 'availability-report__total' : undefined}>
      <th scope="row" title={row.name} className={ended ? 'availability-report__heat-ended' : undefined}>
        {row.total ? ta('Total') : row.name}
        {ended && <span className="availability-report__badge">{endedLabel(row.endedAt as number, locale, timeZone)}</span>}
      </th>
      {row.values.map((value, index) => (
        <td key={columns[index].key}>
          <span className={`availability-report__cell ${value === null ? 'availability-report__cell--none' : `heat-${heatClass(value, target)}`}`} title={`${row.name}, ${columns[index].label}: ${value === null ? '–' : formatAvailability(value, locale)}`}>
            {heatCellText(value, locale)}
          </span>
        </td>
      ))}
    </tr>
  )
}

export function Heatmap(props: { heat: ReportData['heat']; target: number; locale: string; timeZone?: string; endedStyle?: HeatEndedStyle }) {
  const { heat, target, locale, timeZone = 'UTC', endedStyle = 'label' } = props
  const rowProps: RowProps = { columns: heat.columns, target, locale, timeZone, endedStyle }
  const hasGaps = heat.rows.some((row) => row.values.some((value) => value === null))
  const total = heat.rows.filter((row) => row.total)
  const [firstChunk = [], ...moreChunks] = chunkRows(heat.rows.filter((row) => !row.total))
  const head = (
    <thead>
      <tr>
        <th />
        {heat.columns.map((column) => (
          <th key={column.key} className="availability-report__col">{column.label.slice(0, 3)}</th>
        ))}
      </tr>
    </thead>
  )
  const legend = [
    ['100 %', 0],
    [ta('from 99.9 %'), 1],
    [ta('from 99.5 %'), 2],
    [`${ta('from target')} (${formatAvailability(target, locale)})`, 3],
    [ta('below target'), 4],
  ] as const
  return (
    <div data-testid="report-heat">
      <div className="availability-report__scroll">
        <table className="availability-report__heat">
          {head}
          <tbody>
            {total.map((row) => <Row key="total" row={row} {...rowProps} />)}
            {firstChunk.map((row) => <Row key={row.name} row={row} {...rowProps} />)}
          </tbody>
        </table>
        {moreChunks.map((chunk, index) => {
          const from = (index + 1) * HEAT_CHUNK_SIZE + 1
          return (
            <details key={from}>
              <summary>{ta('Rows')} {from} {ta('to')} {from + chunk.length - 1}</summary>
              <table className="availability-report__heat">
                {head}
                <tbody>
                  {chunk.map((row) => <Row key={row.name} row={row} {...rowProps} />)}
                </tbody>
              </table>
            </details>
          )
        })}
      </div>
      <div className="availability-report__legend">
        {legend.map(([text, level]) => (
          <span key={level}><i className={`heat-${level}`} />{text}</span>
        ))}
        {hasGaps && <span><i className="availability-report__cell--none" />{ta('no value')}</span>}
      </div>
    </div>
  )
}
