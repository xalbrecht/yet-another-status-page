import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getWithReset } from '../utils/api-retry'

/**
 * Lesehilfe der E2E-Tests (#278): Der Server schließt ruhende Verbindungen nach 6 s. Eine Anfrage im selben Moment trifft die
 * geschlossene Verbindung (`ECONNRESET`, `socket hang up`). Nur dieser Abbruch wird wiederholt, jeder andere Fehler nicht.
 */
const fake = (outcomes: Array<Error | string>) => {
  let calls = 0
  return {
    get calls() {
      return calls
    },
    get: async () => {
      const outcome = outcomes[calls++]
      if (outcome instanceof Error) throw outcome
      return outcome
    },
  }
}

test('wiederholt nach einem Verbindungsabbruch und liefert die Antwort', async () => {
  const request = fake([new Error('apiRequestContext.get: read ECONNRESET'), new Error('apiRequestContext.get: socket hang up'), 'ok'])
  assert.equal(await getWithReset(request as never, '/x'), 'ok')
  assert.equal(request.calls, 3)
})

test('gibt nach drei Abbrüchen auf', async () => {
  const request = fake([new Error('read ECONNRESET'), new Error('read ECONNRESET'), new Error('read ECONNRESET'), 'ok'])
  await assert.rejects(() => getWithReset(request as never, '/x'), /ECONNRESET/)
  assert.equal(request.calls, 3)
})

test('wiederholt keinen anderen Fehler', async () => {
  const request = fake([new Error('Timeout 30000ms exceeded'), 'ok'])
  await assert.rejects(() => getWithReset(request as never, '/x'), /Timeout/)
  assert.equal(request.calls, 1)
})
