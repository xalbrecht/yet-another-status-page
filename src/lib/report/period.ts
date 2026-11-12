import { addZonedDays, formatDateSlug, parseDateSlug, zonedDateToUtc } from '@/lib/datetime'

/**
 * Berichtszeiträume (Konzept 4 und 6): Monat, Quartal, Halbjahr, Jahr oder ein freier Zeitraum, mit Grenzen in der
 * Zeitzone aus den Einstellungen. `end` ist ausschließlich. Liegt „jetzt“ im Zeitraum, endet er jetzt (`partial`).
 */
export type ReportPeriod = { key: string; label: string; start: number; end: number; partial: boolean }

export type PeriodResult =
  | { ok: true; period: ReportPeriod; previous: ReportPeriod; months: ReportPeriod[] }
  | { ok: false; error: string }

const invalid = (error: string): PeriodResult => ({ ok: false, error })

type Span = { startYear: number; startMonth: number; months: number }

/** Beginn eines Monats in der Zeitzone. Monate außerhalb 1 bis 12 laufen über die Jahresgrenze. */
function monthStart(year: number, month: number, timeZone: string): number {
  const date = new Date(Date.UTC(year, month - 1, 1))
  return zonedDateToUtc({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: 1 }, timeZone).getTime()
}

function formatSpanLabel(kind: 'month' | 'quarter' | 'half' | 'year', span: Span, locale: string, timeZone: string): string {
  const quarter = Math.floor((span.startMonth - 1) / 3) + 1
  const half = span.startMonth <= 6 ? 1 : 2
  if (kind === 'quarter') return `Q${quarter} ${span.startYear}`
  if (kind === 'half') return `H${half} ${span.startYear}`
  if (kind === 'year') return String(span.startYear)
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone }).format(
    new Date(monthStart(span.startYear, span.startMonth, timeZone) + 12 * 3600_000),
  )
}

function spanToPeriod(
  kind: 'month' | 'quarter' | 'half' | 'year',
  span: Span,
  now: number,
  locale: string,
  timeZone: string,
): ReportPeriod {
  const start = monthStart(span.startYear, span.startMonth, timeZone)
  const fullEnd = monthStart(span.startYear, span.startMonth + span.months, timeZone)
  const partial = now >= start && now < fullEnd
  const key =
    kind === 'month'
      ? `${span.startYear}-${String(span.startMonth).padStart(2, '0')}`
      : kind === 'quarter'
        ? `${span.startYear}-Q${Math.floor((span.startMonth - 1) / 3) + 1}`
        : kind === 'half'
          ? `${span.startYear}-H${span.startMonth <= 6 ? 1 : 2}`
          : String(span.startYear)
  return { key, label: formatSpanLabel(kind, span, locale, timeZone), start, end: partial ? now : fullEnd, partial }
}

function shiftSpan(span: Span, direction: -1 | 1): Span {
  const index = span.startYear * 12 + (span.startMonth - 1) + direction * span.months
  return { startYear: Math.floor(index / 12), startMonth: (index % 12) + 1, months: span.months }
}

/** Die 12 Monate bis einschließlich des Monats, in dem der Zeitraum endet, aufsteigend. */
function trailingMonths(periodEnd: number, now: number, locale: string, timeZone: string): ReportPeriod[] {
  const slug = parseDateSlug(formatDateSlug(new Date(periodEnd - 1), timeZone))
  if (!slug) return []
  let span: Span = { startYear: slug.year, startMonth: slug.month, months: 1 }
  const months: ReportPeriod[] = []
  for (let i = 0; i < 12; i++) {
    months.unshift(spanToPeriod('month', span, now, locale, timeZone))
    span = shiftSpan(span, -1)
  }
  return months
}

/** Zerlegt einen Zeitraum in Kalendermonate. Der erste und der letzte Monat werden auf den Zeitraum gekürzt. */
export function periodMonths(period: ReportPeriod, now: number, locale: string, timeZone: string): ReportPeriod[] {
  const first = parseDateSlug(formatDateSlug(new Date(period.start), timeZone))
  if (!first) return []
  let span: Span = { startYear: first.year, startMonth: first.month, months: 1 }
  const result: ReportPeriod[] = []
  for (let guard = 0; guard < 600; guard++) {
    const full = spanToPeriod('month', span, Number.POSITIVE_INFINITY, locale, timeZone)
    if (full.start >= period.end) break
    const from = Math.max(full.start, period.start)
    const to = Math.min(full.end, period.end)
    if (to > from) result.push({ key: full.key, label: full.label, start: from, end: to, partial: now >= from && now < full.end && to === now })
    span = shiftSpan(span, 1)
  }
  return result
}

function parseDay(value: string | undefined): { year: number; month: number; day: number } | null {
  if (!value) return null
  const parts = parseDateSlug(value)
  if (!parts) return null
  const check = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  return check.getUTCMonth() === parts.month - 1 && check.getUTCDate() === parts.day ? parts : null
}

/** Auswahl für die Zeitraumwahl: letzte 12 Monate, Quartale, Halbjahre, Jahre (neueste zuerst), zuletzt der freie Zeitraum. */
export function periodOptions(now: number, timeZone: string, locale: string): Array<{ value: string; label: string }> {
  const today = parseDateSlug(formatDateSlug(new Date(now), timeZone))
  if (!today) return []
  const options: Array<{ value: string; label: string }> = []
  const push = (kind: 'month' | 'quarter' | 'half' | 'year', span: Span) => {
    const period = spanToPeriod(kind, span, now, locale, timeZone)
    if (period.start <= now) options.push({ value: period.key, label: period.label })
  }
  let month: Span = { startYear: today.year, startMonth: today.month, months: 1 }
  for (let i = 0; i < 12; i++) {
    push('month', month)
    month = shiftSpan(month, -1)
  }
  let quarter: Span = { startYear: today.year, startMonth: Math.floor((today.month - 1) / 3) * 3 + 1, months: 3 }
  for (let i = 0; i < 4; i++) {
    push('quarter', quarter)
    quarter = shiftSpan(quarter, -1)
  }
  let half: Span = { startYear: today.year, startMonth: today.month <= 6 ? 1 : 7, months: 6 }
  for (let i = 0; i < 3; i++) {
    push('half', half)
    half = shiftSpan(half, -1)
  }
  for (let year = today.year; year > today.year - 3; year--) push('year', { startYear: year, startMonth: 1, months: 12 })
  options.push({ value: 'custom', label: 'Freier Zeitraum' })
  return options
}

export function resolvePeriod(
  input: { period?: string; from?: string; to?: string },
  now: number,
  timeZone: string,
  locale: string,
): PeriodResult {
  const key = input.period?.trim() ?? ''

  if (key === 'custom') {
    const from = parseDay(input.from)
    const to = parseDay(input.to)
    if (!from || !to) return invalid('Der freie Zeitraum braucht einen gültigen Beginn und ein gültiges Ende (JJJJ-MM-TT).')
    const start = zonedDateToUtc(from, timeZone).getTime()
    const toDate = zonedDateToUtc(to, timeZone)
    const fullEnd = addZonedDays(toDate, 1, timeZone).getTime()
    if (fullEnd <= start) return invalid('Das Ende liegt vor dem Beginn.')
    if (start > now) return invalid('Der Zeitraum liegt in der Zukunft.')
    const days = Math.round((fullEnd - start) / 86_400_000)
    const previousStart = addZonedDays(new Date(start), -days, timeZone).getTime()
    const partial = now < fullEnd
    const format = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone })
    const label = `${format.format(new Date(start + 3600_000))} – ${format.format(new Date(fullEnd - 3600_000))}`
    const period: ReportPeriod = { key: 'custom', label, start, end: partial ? now : fullEnd, partial }
    const previous: ReportPeriod = { key: 'custom', label: '', start: previousStart, end: start, partial: false }
    return { ok: true, period, previous, months: trailingMonths(period.end, now, locale, timeZone) }
  }

  let kind: 'month' | 'quarter' | 'half' | 'year'
  let span: Span
  if (key === '') {
    const today = parseDateSlug(formatDateSlug(new Date(now), timeZone))
    if (!today) return invalid('Der Zeitraum ist ungültig.')
    kind = 'month'
    span = shiftSpan({ startYear: today.year, startMonth: today.month, months: 1 }, -1)
  } else {
    const match = /^(\d{4})(?:-(0[1-9]|1[0-2])|-Q([1-4])|-H([12]))?$/.exec(key)
    if (!match) return invalid('Der Zeitraum ist ungültig. Erlaubt sind 2026-10, 2026-Q3, 2026-H1, 2026 oder custom.')
    const year = Number(match[1])
    if (match[2]) {
      kind = 'month'
      span = { startYear: year, startMonth: Number(match[2]), months: 1 }
    } else if (match[3]) {
      kind = 'quarter'
      span = { startYear: year, startMonth: (Number(match[3]) - 1) * 3 + 1, months: 3 }
    } else if (match[4]) {
      kind = 'half'
      span = { startYear: year, startMonth: Number(match[4]) === 1 ? 1 : 7, months: 6 }
    } else {
      kind = 'year'
      span = { startYear: year, startMonth: 1, months: 12 }
    }
  }

  const period = spanToPeriod(kind, span, now, locale, timeZone)
  if (period.start > now) return invalid('Der Zeitraum liegt in der Zukunft.')
  const previous = spanToPeriod(kind, shiftSpan(span, -1), now, locale, timeZone)
  return { ok: true, period, previous: { ...previous, partial: false }, months: trailingMonths(period.end, now, locale, timeZone) }
}
