import { randomUUID } from 'node:crypto'

import { encodeCursor } from './cursor.js'
import { paginationQuerySchema } from './pagination-query.dto.js'

const cursor = { id: randomUUID(), value: new Date('2026-11-09T10:00:00Z') }

describe('paginationQuerySchema', () => {
  it('defaults the limit and decodes the cursor', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ limit: 20 })
    expect(
      paginationQuerySchema.parse({ cursor: encodeCursor(cursor), limit: '5' }),
    ).toEqual({ cursor, limit: 5 })
  })

  it.each([
    { limit: '0' },
    { limit: '101' },
    { limit: '2.5' },
    { cursor: 'bad' },
    { page: '2' },
  ])('rejects %o', (query) => {
    expect(paginationQuerySchema.safeParse(query).success).toBe(false)
  })
})
