import { randomUUID } from 'node:crypto'

import { decodeCursor, encodeCursor } from './cursor.js'

const cursor = { id: randomUUID(), value: new Date('2026-11-09T10:00:00Z') }

describe('cursor', () => {
  it('decodes what it encodes', () => {
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor)
  })

  it.each([
    ['not a cursor', 'not base64 JSON'],
    ['a wrong shape', Buffer.from('[1]').toString('base64url')],
    [
      'an id that is not a UUID',
      Buffer.from(
        JSON.stringify({ id: { $gt: '' }, value: cursor.value }),
      ).toString('base64url'),
    ],
    [
      'an invalid date',
      Buffer.from(JSON.stringify({ id: cursor.id, value: 'soon' })).toString(
        'base64url',
      ),
    ],
  ])('rejects %s', (_case, value) => {
    expect(decodeCursor(value)).toBeNull()
  })
})
