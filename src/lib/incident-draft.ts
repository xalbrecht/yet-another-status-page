/**
 * Entwurf einer Störung aus einer Vorlage (geführte Seite „Neu erstellen mit Vorlage“): Dienste benennen, Vorlage ausfüllen,
 * fehlende Angaben nennen, Eingabe der Schnittstelle prüfen. Reine Funktionen ohne Datenbankzugriff und ohne Texte der
 * Oberfläche, die Meldungen und Bezeichnungen kommen von außen.
 */
// Aus `template-text.ts`, nicht aus `message-templates.ts`: Diese Datei läuft auch im Browser, `message-templates.ts` zieht die Collections nach.
import { formatServiceList, NTFY_TEXT_MAX_LENGTH, renderTemplate, SMS_TEXT_MAX_LENGTH } from '@/lib/template-text'

export type Impact = 'degraded' | 'partial' | 'major'
export const IMPACTS: readonly Impact[] = ['degraded', 'partial', 'major']

/** Wie die Dienste im Text stehen: einzeln aufgezählt oder als „alle Dienste der Gruppe …“. Die zweite Form gilt nur, wenn alle Dienste der Gruppe gewählt sind. */
export type ServiceNaming = 'list' | 'group'

/** Obergrenzen der Schnittstelle. Der Text einer Störung ist ein Freitext, die Grenzen schützen nur vor Missbrauch. */
export const TITLE_MAX_LENGTH = 300
export const MESSAGE_MAX_LENGTH = 10_000
export const SERVICES_MAX = 200

export function servicesPhrase(input: {
  selectedNames: string[]
  groupServiceCount: number
  groupName: string
  naming: ServiceNaming
  locale: string
  /** Text für „alle Dienste der Gruppe G“ in der Sprache der Oberfläche */
  groupPhrase: (groupName: string) => string
}): string {
  const all = input.groupServiceCount > 1 && input.selectedNames.length === input.groupServiceCount
  if (all && input.naming === 'group') return input.groupPhrase(input.groupName)
  return formatServiceList(input.selectedNames, input.locale)
}

export type TemplateTexts = { title: string; body: string; smsBody?: string | null; ntfyBody?: string | null }
export type DraftTexts = { title: string; body: string; smsBody: string; ntfyBody: string }

/** Füllt die Texte einer Vorlage. `{{link}}` bleibt stehen, die Adresse der Meldung besteht erst nach dem Anlegen. */
export function fillTemplate(template: TemplateTexts, values: { services: string; group: string; impact: string }): DraftTexts {
  const fill = (text: string | null | undefined) => renderTemplate(text ?? '', values)
  return { title: fill(template.title), body: fill(template.body), smsBody: fill(template.smsBody), ntfyBody: fill(template.ntfyBody) }
}

export type MissingField = 'group' | 'services' | 'template' | 'impact' | 'title' | 'body' | 'sms-too-long' | 'ntfy-too-long'

/** Was noch fehlt, bevor die Vorschau möglich ist. Leer: alles da. */
export function missingFields(draft: {
  groupId: string
  serviceIds: string[]
  templateChoice: string | null
  impact: Impact | null
  texts: DraftTexts
}): MissingField[] {
  const missing: MissingField[] = []
  if (!draft.groupId) missing.push('group')
  else if (draft.serviceIds.length === 0) missing.push('services')
  if (draft.templateChoice === null) missing.push('template')
  if (draft.impact === null) missing.push('impact')
  if (draft.templateChoice !== null) {
    if (draft.texts.title.trim() === '') missing.push('title')
    if (draft.texts.body.trim() === '') missing.push('body')
  }
  if (draft.texts.smsBody.length > SMS_TEXT_MAX_LENGTH) missing.push('sms-too-long')
  if (draft.texts.ntfyBody.length > NTFY_TEXT_MAX_LENGTH) missing.push('ntfy-too-long')
  return missing
}

export type IncidentFromTemplateInput = {
  title: string
  message: string
  impact: Impact
  serviceIds: number[]
  smsBody?: string
  ntfyBody?: string
}

export type InputCheck = { ok: true; value: IncidentFromTemplateInput } | { ok: false; errors: string[] }

/** Prüft den Anfragekörper der Schnittstelle. Unbekannte Felder werden ignoriert. */
export function checkIncidentInput(raw: unknown): InputCheck {
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
  const title = text('title', TITLE_MAX_LENGTH, true)
  const message = text('message', MESSAGE_MAX_LENGTH, true)
  const smsBody = text('smsBody', SMS_TEXT_MAX_LENGTH, false)
  const ntfyBody = text('ntfyBody', NTFY_TEXT_MAX_LENGTH, false)
  const impact = IMPACTS.find((candidate) => candidate === body.impact)
  if (!impact) errors.push('impact')
  const ids = body.serviceIds
  const serviceIds =
    Array.isArray(ids) && ids.length >= 1 && ids.length <= SERVICES_MAX && ids.every((id) => Number.isInteger(id) && (id as number) > 0)
      ? Array.from(new Set(ids as number[]))
      : null
  if (!serviceIds) errors.push('serviceIds')
  if (errors.length > 0 || !title || !message || !impact || !serviceIds) return { ok: false, errors }
  return { ok: true, value: { title, message, impact, serviceIds, ...(smsBody ? { smsBody } : {}), ...(ntfyBody ? { ntfyBody } : {}) } }
}
