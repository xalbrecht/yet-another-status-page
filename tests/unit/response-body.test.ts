import { test } from 'node:test'
import assert from 'node:assert/strict'
import { failureMessage, parseJsonBody } from '@/lib/response-body'

const withStatus = (status: number) => `HTTP ${status}`

test('parseJsonBody liest JSON und gibt bei HTML oder leerem Text null zurück', () => {
  assert.deepEqual(parseJsonBody('{"a":1}'), { a: 1 })
  assert.equal(parseJsonBody('<html><body>502 Bad Gateway</body></html>'), null)
  assert.equal(parseJsonBody(''), null)
})

test('failureMessage nimmt die Meldung der Route, sonst den Hinweis mit dem HTTP-Status', () => {
  assert.equal(failureMessage(409, { error: 'Die Vorschau ist veraltet.' }, withStatus), 'Die Vorschau ist veraltet.')
  assert.equal(failureMessage(502, null, withStatus), 'HTTP 502')
  assert.equal(failureMessage(500, { error: '' }, withStatus), 'HTTP 500')
  assert.equal(failureMessage(500, { error: 5 }, withStatus), 'HTTP 500')
})
