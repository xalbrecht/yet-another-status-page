import { ta } from '@/lib/i18n/admin'
import type { ReportContext } from '@/lib/report/load'
import { groupBlocks } from './blocks-group'
import { overallBlocks } from './blocks-overall'
import { buildWorkbook } from './excel'
import { createPdfBuilder } from './pdf'
import { svgToPng } from './render'

/**
 * Dateien des Exports (Konzept 3 und 6): Bilder des Gesamtberichts, je Gruppe ein Ordner mit Gruppenblatt und
 * Einzelbildern, Excel und PDF. Die Funktion erzeugt die Dateien nacheinander, Gruppe für Gruppe, damit nie alle Bilder
 * gleichzeitig im Speicher liegen. Route und Mailversand (Issue #65) nutzen dieselbe Funktion.
 */
export type ExportFile = { path: string; data: Uint8Array }

/** Dateiname aus einem Gruppennamen: ASCII, Kleinbuchstaben, `-` als Trenner. Leer ergibt `gruppe`. */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'gruppe'
}

/** Ordnernamen je Gruppe. Gleiche Namen bekommen `-<id>` angehängt. */
export function uniqueSlugs(groups: Array<{ id: number; name: string }>): Map<number, string> {
  const counts = new Map<string, number>()
  for (const group of groups) counts.set(slugify(group.name), (counts.get(slugify(group.name)) ?? 0) + 1)
  return new Map(groups.map((group) => [group.id, (counts.get(slugify(group.name)) ?? 0) > 1 ? `${slugify(group.name)}-${group.id}` : slugify(group.name)]))
}

export async function* exportFiles(context: ReportContext, options: { groupId?: number } = {}): AsyncGenerator<ExportFile> {
  const base = `verfuegbarkeitsbericht-${context.period.key}`
  const slugs = uniqueSlugs(context.groups)

  if (options.groupId !== undefined) {
    const slug = slugs.get(options.groupId)
    if (slug === undefined) throw new Error(`Gruppe ${options.groupId} nicht gefunden`)
    const built = context.build(String(options.groupId))
    for (const block of groupBlocks(built.data, context.locale, context.period.label)) {
      yield { path: `${base}/gruppen/${slug}/${block.file}`, data: await svgToPng(block.svg) }
    }
    return
  }

  const overall = context.build(undefined)
  const pdf = await createPdfBuilder(`${ta('Availability report', 'Verfügbarkeitsbericht')} ${context.period.label}`)

  pdf.addHeading(ta('Overall report', 'Gesamtbericht'))
  for (const block of overallBlocks(overall.data, context.locale, context.period.label)) {
    const png = await svgToPng(block.svg)
    await pdf.addImage(png)
    yield { path: `${base}/gesamt/${block.file}`, data: png }
  }

  for (const entry of overall.data.groupList) {
    const slug = slugs.get(entry.id) ?? slugify(entry.name)
    const built = context.build(String(entry.id))
    for (const block of groupBlocks(built.data, context.locale, context.period.label)) {
      const png = await svgToPng(block.svg)
      if (block.file === '00-gruppenblatt.png') {
        pdf.addHeading(entry.name)
        await pdf.addImage(png)
      }
      yield { path: `${base}/gruppen/${slug}/${block.file}`, data: png }
    }
  }

  pdf.addHeading(ta('Notes', 'Hinweise'))
  pdf.addText([
    `${ta('Incidents not clearly classified, counted as Partial Outage', 'Nicht eindeutig eingeordnete Vorfälle, als Teilausfall gewertet')}: ${overall.data.footnotes.unsure}.`,
    `${ta('Incidents without a service, not considered', 'Vorfälle ohne Dienst, nicht berücksichtigt')}: ${overall.data.footnotes.withoutService}.`,
  ])
  yield { path: `${base}/${base}.xlsx`, data: await buildWorkbook({ data: overall.data, params: overall.params, period: context.period, timeZone: context.timeZone }) }
  yield { path: `${base}/${base}.pdf`, data: await pdf.finish() }
}
