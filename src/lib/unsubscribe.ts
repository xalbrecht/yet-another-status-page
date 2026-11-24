import type { Payload } from 'payload'

export type UnsubscribeResult = 'unsubscribed' | 'already-unsubscribed' | 'not-found'

/** Meldet den Abonnenten mit diesem Token ab (setzt `active` auf false). */
export async function unsubscribeByToken(payload: Payload, token: string): Promise<UnsubscribeResult> {
  const result = await payload.find({
    collection: 'subscribers',
    where: { unsubscribeToken: { equals: token } },
    limit: 1,
  })

  const subscriber = result.docs[0]
  if (!subscriber) return 'not-found'
  if (!subscriber.active) return 'already-unsubscribed'

  await payload.update({
    collection: 'subscribers',
    id: subscriber.id,
    data: { active: false },
  })
  return 'unsubscribed'
}
