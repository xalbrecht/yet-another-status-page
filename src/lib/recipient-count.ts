import type { Payload, PayloadRequest } from 'payload'
import { deliverableSubscribersWhere, groupsForDelivery } from '@/lib/subscriber-filter'

type Draft = { channel?: string | null; relatedIncident?: unknown; relatedMaintenance?: unknown }

const idOf = (value: unknown): string => (value === null || value === undefined ? '' : String(typeof value === 'object' ? (value as { id: unknown }).id : value))

/** Zwischenspeicher einer Anfrage: Gruppen je Bezugsobjekt und Zahlen je Kanal und Gruppenwahl. */
function memo(req: PayloadRequest): Map<string, Promise<unknown>> {
  const context = req.context as Record<string, unknown>
  if (!(context.recipientCountMemo instanceof Map)) context.recipientCountMemo = new Map<string, Promise<unknown>>()
  return context.recipientCountMemo as Map<string, Promise<unknown>>
}

function once<T>(cache: Map<string, Promise<unknown>>, key: string, load: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) cache.set(key, load())
  return cache.get(key) as Promise<T>
}

/**
 * Geschätzte Empfängerzahl eines Entwurfs: Abonnenten, deren Wahl zu den Dienstgruppen der Meldung passt.
 *
 * Eine Liste mit mehreren Entwürfen ruft den Hook je Entwurf auf. Innerhalb einer Anfrage (`req.context`) wird deshalb
 * jedes Bezugsobjekt nur einmal gelesen und jede Kombination aus Kanal und Gruppenwahl nur einmal gezählt.
 */
export async function estimateRecipients(payload: Payload, draft: Draft, req: PayloadRequest): Promise<number> {
  const cache = memo(req)
  const channel = draft.channel || 'both'
  const groups = await once(cache, `groups:${idOf(draft.relatedIncident)}:${idOf(draft.relatedMaintenance)}`, () => groupsForDelivery(payload, draft, req))
  const key = [...new Set(groups)].sort((a, b) => a - b).join(',')
  const countOf = async (type: 'email' | 'sms') =>
    (await once(cache, `count:${type}:${key}`, () => payload.count({ collection: 'subscribers', where: deliverableSubscribersWhere(type, groups), req }))).totalDocs
  let count = 0
  if (channel === 'email' || channel === 'both') count += await countOf('email')
  if (channel === 'sms' || channel === 'both') count += await countOf('sms')
  return count
}
