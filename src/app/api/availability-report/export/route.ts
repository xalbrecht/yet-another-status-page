import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { headers } from 'next/headers'
import config from '@payload-config'
import { Zip, ZipPassThrough } from 'fflate'
import { isTestMode } from '@/lib/access'
import { ta } from '@/lib/i18n/admin'
import { buildWorkbook } from '@/lib/report/export/excel'
import { exportFiles, uniqueSlugs } from '@/lib/report/export/files'
import { loadReportContext } from '@/lib/report/load'

/**
 * Export des Berichts als ZIP (alle Dateien), PDF oder Excel (Konzept 6). Nur für angemeldete Nutzer, im Testmodus
 * offen wie die übrigen Routen. Ungültige Eingaben ergeben Status 400, bevor das erste Byte gesendet wird. Die
 * ZIP-Datei wird als Datenstrom geschrieben: Gruppe für Gruppe, jede Datei erst, wenn der Leser die vorige abgeholt hat.
 */
export const runtime = 'nodejs'

const FORMATS = ['zip', 'pdf', 'xlsx'] as const
type Format = (typeof FORMATS)[number]

const TYPES: Record<Format, string> = {
  zip: 'application/zip',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status })

const attachment = (filename: string) => `attachment; filename="${filename}"`

/** ZIP-Datenstrom aus dem Datei-Generator. Fehler beenden den Strom, bereits gesendete Teile bleiben gesendet. */
function zipStream(files: AsyncGenerator<{ path: string; data: Uint8Array }>): ReadableStream<Uint8Array> {
  const chunks: Uint8Array[] = []
  let finished = false
  let failure: unknown = null
  const zip = new Zip((error, chunk, final) => {
    if (error) failure = error
    else chunks.push(chunk)
    if (final) finished = true
  })
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (chunks.length === 0 && !finished && !failure) {
          const next = await files.next()
          if (next.done) {
            zip.end()
          } else {
            const entry = new ZipPassThrough(next.value.path)
            zip.add(entry)
            entry.push(next.value.data, true)
          }
        }
        if (failure) throw failure
        const chunk = chunks.shift()
        if (chunk) controller.enqueue(chunk)
        if (finished && chunks.length === 0) controller.close()
      } catch (error) {
        console.error('[availability-report-export] stream failed:', error)
        controller.error(error)
      }
    },
    async cancel() {
      await files.return(undefined)
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await headers() })
    if (!user && !isTestMode()) return fail(ta('Authentication required'), 401)

    const search: Record<string, string | string[] | undefined> = {}
    for (const key of new Set(request.nextUrl.searchParams.keys())) {
      const values = request.nextUrl.searchParams.getAll(key)
      search[key] = values.length > 1 ? values : values[0]
    }
    const format = FORMATS.find((value) => value === search.format)
    if (!format) return fail(ta('The format must be zip, pdf or xlsx.', 'Das Format muss zip, pdf oder xlsx sein.'))

    const loaded = await loadReportContext(payload, search)
    if (!loaded.ok) return fail(loaded.error)
    const { context } = loaded
    const base = `verfuegbarkeitsbericht-${context.period.key}`

    let groupId: number | undefined
    if (format === 'zip' && typeof search.group === 'string' && search.group.trim()) {
      groupId = Number(search.group)
      if (!context.groups.some((group) => group.id === groupId)) return fail(ta('The selected group was not found.', 'Die gewählte Gruppe wurde nicht gefunden.'))
    }

    if (format === 'xlsx') {
      const built = context.build(undefined)
      const buffer = await buildWorkbook({ data: built.data, params: built.params, period: context.period, timeZone: context.timeZone })
      return new Response(new Uint8Array(buffer), { headers: { 'Content-Type': TYPES.xlsx, 'Content-Disposition': attachment(`${base}.xlsx`) } })
    }

    if (format === 'pdf') {
      for await (const file of exportFiles(context)) {
        if (file.path.endsWith('.pdf')) return new Response(new Uint8Array(file.data), { headers: { 'Content-Type': TYPES.pdf, 'Content-Disposition': attachment(`${base}.pdf`) } })
      }
      return fail(ta('Unknown error', 'Unbekannter Fehler'), 500)
    }

    const suffix = groupId === undefined ? '' : `-${uniqueSlugs(context.groups).get(groupId)}`
    return new Response(zipStream(exportFiles(context, { groupId })), {
      headers: { 'Content-Type': TYPES.zip, 'Content-Disposition': attachment(`${base}${suffix}.zip`) },
    })
  } catch (error) {
    console.error('[availability-report-export] failed:', error)
    return fail(ta('Unknown error'), 500)
  }
}
