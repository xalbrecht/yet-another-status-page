/**
 * Vorlage bei einer Aktualisierung einer bestehenden Störung (Formular im Admin): welche Vorlagen zum gewählten Status passen
 * und wie die Platzhalter aus den Angaben des Formulars gefüllt werden. Reine Funktionen, laufen auch im Browser.
 */
import { formatServiceList, renderTemplate } from '@/lib/template-text'

export type UpdateTemplate = {
  id: number
  name: string
  status: string
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
 * Auswirkung der Störung. Ohne Wert bleibt der Platzhalter nicht stehen, sondern wird leer (anders als `{{link}}`, den erst das
 * Speichern ersetzt).
 */
export function fillUpdateTemplate(
  template: UpdateTemplate,
  values: { serviceNames: string[]; groupNames: string[]; impact: string; locale: string },
): UpdateTexts {
  const map = {
    services: formatServiceList(values.serviceNames, values.locale),
    group: formatServiceList(values.groupNames, values.locale),
    impact: values.impact,
  }
  const fill = (text: string | null | undefined) => renderTemplate(text ?? '', map)
  return { message: fill(template.body), smsBody: fill(template.smsBody), ntfyBody: fill(template.ntfyBody) }
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
