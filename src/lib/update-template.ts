/**
 * Vorlage bei einer Aktualisierung einer bestehenden Störung (Formular im Admin): welche Vorlagen zum gewählten Status passen
 * und wie die Platzhalter aus den Angaben des Formulars gefüllt werden. Reine Funktionen, laufen auch im Browser.
 */
import { formatServiceList, placeholdersIn, renderTemplate } from '@/lib/template-text'

export type UpdateTemplate = {
  id: number
  name: string
  status: string
  title?: string
  body: string
  smsBody?: string | null
  ntfyBody?: string | null
}

export type UpdateTexts = { message: string; smsBody: string; ntfyBody: string }

/** Kennungen aus dem Wert eines Verknüpfungsfeldes (Kennung oder Objekt mit `id`). */
export function idsOf(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item) => item !== null && item !== undefined && item !== '')
    .map((item) => Number(item && typeof item === 'object' ? (item as { id?: unknown; value?: unknown }).id ?? (item as { value?: unknown }).value : item))
    .filter((id) => Number.isFinite(id))
}

/** Vorlagen der Art „Störung“ zum Status, nach Name sortiert. */
export function templatesForStatus(templates: UpdateTemplate[], status: string | null | undefined): UpdateTemplate[] {
  if (!status) return []
  return templates.filter((template) => template.status === status).sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Füllt die Texte einer Vorlage. `{{services}}` sind die Namen der betroffenen Dienste, `{{group}}` die Gruppe(n), `{{impact}}` die
 * Auswirkung der Störung, `{{start}}` und `{{end}}` Beginn und Ende der Wartung. Ohne Wert wird der Platzhalter leer (anders als
 * `{{link}}`, den erst das Speichern ersetzt).
 */
export function fillUpdateTemplate(
  template: UpdateTemplate,
  values: { serviceNames: string[]; groupNames: string[]; impact?: string; start?: string; end?: string; locale: string },
): UpdateTexts {
  const map = {
    services: formatServiceList(values.serviceNames, values.locale),
    group: formatServiceList(values.groupNames, values.locale),
    impact: values.impact ?? '',
    start: values.start ?? '',
    end: values.end ?? '',
  }
  const fill = (text: string | null | undefined) => renderTemplate(text ?? '', map)
  return { message: fill(template.body), smsBody: fill(template.smsBody), ntfyBody: fill(template.ntfyBody) }
}

/** Nutzt eine der Texte der Vorlage den Platzhalter? */
export function templateUses(template: UpdateTemplate, name: string): boolean {
  return [template.title, template.body, template.smsBody, template.ntfyBody].some((text) => placeholdersIn(text ?? '').includes(name))
}

/** Zeitpunkt einer Wartung für den Text, in der Zeitzone und Sprache der Installation (wie in den Benachrichtigungen). Ungültig: leer. */
export function formatScheduleValue(value: unknown, locale: string, timeZone: string): string {
  if (typeof value !== 'string' || value === '') return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }
  try {
    return date.toLocaleString(locale, { ...options, timeZone })
  } catch {
    return date.toLocaleString('en', { ...options, timeZone: 'UTC' })
  }
}

/** Pfad eines Geschwisterfeldes derselben Zeile: `updates.2.message` → `updates.2.smsBody`. */
export function siblingPath(path: string, name: string): string {
  const parts = path.split('.')
  parts[parts.length - 1] = name
  return parts.join('.')
}

/** Eine Zeile gilt als neu, wenn ihre Kennung nicht zu den gespeicherten Aktualisierungen gehört. */
export function isNewUpdate(rowId: unknown, savedIds: ReadonlySet<string>): boolean {
  return rowId === undefined || rowId === null || rowId === '' || !savedIds.has(String(rowId))
}
