/**
 * Entwurf einer Wartung aus einer Vorlage (geführte Seite „Neu erstellen mit Vorlage“, Art „Wartung“): Zeitraum in die Zeitzone der
 * Installation umrechnen, Vorlage ausfüllen, fehlende Angaben nennen, Eingabe der Schnittstelle prüfen. Reine Funktionen ohne
 * Datenbankzugriff und ohne Texte der Oberfläche. Läuft auch im Browser, deshalb nur `template-text.ts` und `incident-draft.ts`.
 */
import { NTFY_TEXT_MAX_LENGTH, renderTemplate, SMS_TEXT_MAX_LENGTH } from '@/lib/template-text'
import { MESSAGE_MAX_LENGTH, SERVICES_MAX, TITLE_MAX_LENGTH, type DraftTexts, type TemplateTexts } from '@/lib/incident-draft'

const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

/** Abweichung der Zeitzone von UTC am Zeitpunkt `ms` in Millisekunden (Ostdeutschland im Winter: +3 600 000). */
function zoneOffsetMs(ms: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(ms))
      .map((part) => [part.type, part.value]),
  )
  const shown = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second))
  return shown - Math.floor(ms / 1000) * 1000
}

/**
 * Wandelt eine Eingabe `JJJJ-MM-TTThh:mm` (Wanduhr in der Zeitzone der Installation) in einen UTC-Zeitpunkt (ISO). Ungültige Eingabe
 * oder unbekannte Zeitzone: `null`. In der Stunde, die beim Wechsel auf Sommerzeit ausfällt, gilt der spätere Zeitpunkt.
 */
export function zonedLocalToUtc(local: string, timeZone: string): string | null {
  const match = LOCAL_PATTERN.exec(local)
  if (!match) return null
  const [year, month, day, hour, minute] = match.slice(1).map(Number)
  const wall = Date.UTC(year, month - 1, day, hour, minute)
  if (new Date(wall).getUTCMonth() !== month - 1) return null
  try {
    const first = wall - zoneOffsetMs(wall, timeZone)
    return new Date(wall - zoneOffsetMs(first, timeZone)).toISOString()
  } catch {
    return null
  }
}

/** Füllt die Texte einer Vorlage der Art „Wartung“. `{{link}}` bleibt stehen, die Adresse besteht erst nach dem Anlegen. */
export function fillMaintenanceTemplate(
  template: TemplateTexts,
  values: { services: string; group: string; start: string; end: string },
): DraftTexts {
  const fill = (text: string | null | undefined) => renderTemplate(text ?? '', values)
  return { title: fill(template.title), body: fill(template.body), smsBody: fill(template.smsBody), ntfyBody: fill(template.ntfyBody) }
}

export type MissingMaintenanceField = 'group' | 'services' | 'start' | 'end-before-start' | 'template' | 'title' | 'body' | 'sms-too-long' | 'ntfy-too-long'

/** Was noch fehlt, bevor die Vorschau möglich ist. Leer: alles da. Das Ende ist optional, es darf nur nicht vor dem Beginn liegen. */
export function missingMaintenanceFields(draft: {
  groupId: string
  serviceIds: string[]
  startUtc: string | null
  endUtc: string | null
  endGiven: boolean
  templateChoice: string | null
  texts: DraftTexts
}): MissingMaintenanceField[] {
  const missing: MissingMaintenanceField[] = []
  if (!draft.groupId) missing.push('group')
  else if (draft.serviceIds.length === 0) missing.push('services')
  if (!draft.startUtc) missing.push('start')
  else if (draft.endGiven && (!draft.endUtc || new Date(draft.endUtc).getTime() < new Date(draft.startUtc).getTime())) missing.push('end-before-start')
  if (draft.templateChoice === null) missing.push('template')
  if (draft.templateChoice !== null) {
    if (draft.texts.title.trim() === '') missing.push('title')
    if (draft.texts.body.trim() === '') missing.push('body')
  }
  if (draft.texts.smsBody.length > SMS_TEXT_MAX_LENGTH) missing.push('sms-too-long')
  if (draft.texts.ntfyBody.length > NTFY_TEXT_MAX_LENGTH) missing.push('ntfy-too-long')
  return missing
}

/** Liegt der Beginn vor `nowMs`? Dann ist die Wartung nach dem Anlegen sofort „Läuft“ (oder „Abgeschlossen“). */
export function startIsInPast(startUtc: string | null, nowMs: number): boolean {
  return startUtc !== null && new Date(startUtc).getTime() < nowMs
}

export type MaintenanceFromTemplateInput = {
  title: string
  message: string
  serviceIds: number[]
  start: string
  end?: string
  smsBody?: string
  ntfyBody?: string
}

export type MaintenanceInputCheck = { ok: true; value: MaintenanceFromTemplateInput } | { ok: false; errors: string[] }

/** Prüft den Anfragekörper der Schnittstelle. Unbekannte Felder werden ignoriert. `start` und `end` sind ISO-Zeitpunkte. */
export function checkMaintenanceInput(raw: unknown): MaintenanceInputCheck {
  const body = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const errors: string[] = []
  const text = (key: string, max: number, required: boolean): string | undefined => {
    const value = body[key]
    if (value === undefined || value === null || value === '') {
      if (required) errors.push(key)
      return undefined
    }
    if (typeof value !== 'string' || value.trim() === '' || value.length > max) {
      errors.push(key)
      return undefined
    }
    return value
  }
  const time = (key: string, required: boolean): string | undefined => {
    const value = body[key]
    if (value === undefined || value === null || value === '') {
      if (required) errors.push(key)
      return undefined
    }
    if (typeof value !== 'string' || Number.isNaN(new Date(value).getTime())) {
      errors.push(key)
      return undefined
    }
    return value
  }
  const title = text('title', TITLE_MAX_LENGTH, true)
  const message = text('message', MESSAGE_MAX_LENGTH, true)
  const smsBody = text('smsBody', SMS_TEXT_MAX_LENGTH, false)
  const ntfyBody = text('ntfyBody', NTFY_TEXT_MAX_LENGTH, false)
  const start = time('start', true)
  const end = time('end', false)
  if (start && end && new Date(end).getTime() < new Date(start).getTime()) errors.push('end')
  const ids = body.serviceIds
  const serviceIds =
    Array.isArray(ids) && ids.length >= 1 && ids.length <= SERVICES_MAX && ids.every((id) => Number.isInteger(id) && (id as number) > 0)
      ? Array.from(new Set(ids as number[]))
      : null
  if (!serviceIds) errors.push('serviceIds')
  if (errors.length > 0 || !title || !message || !start || !serviceIds) return { ok: false, errors }
  return {
    ok: true,
    value: { title, message, serviceIds, start, ...(end ? { end } : {}), ...(smsBody ? { smsBody } : {}), ...(ntfyBody ? { ntfyBody } : {}) },
  }
}
