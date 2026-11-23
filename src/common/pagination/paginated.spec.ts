import { randomUUID } from 'node:crypto'

import { decodeCursor } from './cursor.js'
import { toPage } from './paginated.js'

describe('toPage', () => {
  const items = [1, 2, 3].map((day) => ({
    createdAt: new Date(`2026-11-0${day}T00:00:00Z`),
    id: randomUUID(),
  }))

  it('has no next cursor when everything fits', () => {
    expect(toPage(items, 3, 'createdAt')).toEqual({ items, nextCursor: null })
  })

  it('drops the extra item and points the cursor at the last one', () => {
    const page = toPage(items, 2, 'createdAt')

    expect(page.items).toEqual(items.slice(0, 2))
    expect(decodeCursor(page.nextCursor!)).toEqual({
      id: items[1].id,
      value: items[1].createdAt,
    })
  })
})
