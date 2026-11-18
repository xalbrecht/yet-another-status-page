import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addedIds, relationIds } from '@/lib/affected-services'

test('relationIds liest Kennungen und aufgelöste Objekte als Text', () => {
  assert.deepEqual(relationIds([1, '2', { id: 3 }, null, undefined]), ['1', '2', '3'])
  assert.deepEqual(relationIds(undefined), [])
  assert.deepEqual(relationIds('x'), [])
})

test('addedIds nennt nur neu hinzugekommene Kennungen', () => {
  assert.deepEqual(addedIds(['1', '2', '3'], ['2']), ['1', '3'])
  assert.deepEqual(addedIds(['2'], ['2', '5']), [])
  assert.deepEqual(addedIds([], ['2']), [])
})
