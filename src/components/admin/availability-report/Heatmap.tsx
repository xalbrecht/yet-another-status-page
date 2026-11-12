import React from 'react'
import { ta } from '@/lib/i18n/admin'
import { formatAvailability } from '@/lib/availability'
import type { ReportData } from '@/lib/report/aggregate'
import { chunkRows, HEAT_CHUNK_SIZE, heatCellText, heatClass } from '@/lib/report/heat'

/** Wärmekarte: Zeilen mal Monate. Farbstufen Blau, Gelb, Rot (kein Rot-Grün-Paar). Der erste Block (12 Zeilen) steht sofort, jeder weitere ist aufklappbar. */

function Row(props: { row: ReportData['heat']['rows'][number]; columns: ReportData['heat']['columns']; target: number; locale: string }) {
  const { row, columns, target, locale } = props
  return (
    <tr className={row.total ? 'availability-report__total' : undefined}>
      <th scope="row" title={row.name}>{row.total ? ta('Total', 'Gesamt') : row.name}</th>
      {row.values.map((value, index) => (
        <td key={columns[index].key}>
          <span className={`availability-report__cell heat-${heatClass(value, target)}`} title={`${row.name}, ${columns[index].label}: ${value === null ? '–' : formatAvailability(value, locale)}`}>
            {heatCellText(value, locale)}
          </span>
        </td>
      ))}
    </tr>
  )
}

export function Heatmap(props: { heat: ReportData['heat']; target: number; locale: string }) {
  const { heat, target, locale } = props
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
    [ta('from 99.9 %', 'ab 99,9 %'), 1],
    [ta('from 99.5 %', 'ab 99,5 %'), 2],
    [`${ta('from target', 'ab Ziel')} (${formatAvailability(target, locale)})`, 3],
    [ta('below target', 'unter Ziel'), 4],
  ] as const
  return (
    <div data-testid="report-heat">
      <div className="availability-report__scroll">
        <table className="availability-report__heat">
          {head}
          <tbody>
            {total.map((row) => <Row key="total" row={row} columns={heat.columns} target={target} locale={locale} />)}
            {firstChunk.map((row) => <Row key={row.name} row={row} columns={heat.columns} target={target} locale={locale} />)}
          </tbody>
        </table>
        {moreChunks.map((chunk, index) => {
          const from = (index + 1) * HEAT_CHUNK_SIZE + 1
          return (
            <details key={from}>
              <summary>{ta('Rows', 'Zeilen')} {from} {ta('to', 'bis')} {from + chunk.length - 1}</summary>
              <table className="availability-report__heat">
                {head}
                <tbody>
                  {chunk.map((row) => <Row key={row.name} row={row} columns={heat.columns} target={target} locale={locale} />)}
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
      </div>
    </div>
  )
}
