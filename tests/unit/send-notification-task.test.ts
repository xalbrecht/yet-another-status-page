import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sendNotificationFromCollectionHandler } from '@/tasks/sendNotificationFromCollection'

/**
 * Versandaufgabe (#275): Fehlt die Benachrichtigung, bricht die Aufgabe ab. Sie darf nicht still an alle Abonnenten gehen.
 */
function fakePayload(notification: unknown) {
  const reads: string[] = []
  const payload = {
    findGlobal: async () => ({}),
    findByID: async ({ collection }: { collection: string }) => {
      if (collection === 'notifications') return notification
      return null
    },
    find: async ({ collection }: { collection: string }) => {
      reads.push(collection)
      return { docs: [], hasNextPage: false }
    },
    update: async () => ({}),
    create: async () => ({}),
  }
  return { payload, reads }
}

const input = { notificationId: '1', channel: 'email' as const, itemTitle: 'x', itemUrl: 'http://localhost/i/x' }

test('fehlt die Benachrichtigung, bricht die Aufgabe ab und liest keine Abonnenten', async () => {
  const { payload, reads } = fakePayload(null)
  await assert.rejects(() => sendNotificationFromCollectionHandler({ input, req: { payload: payload as never } }))
  assert.ok(!reads.includes('subscribers'), 'Abonnenten wurden gelesen')
})
