import { encodeCursor } from './cursor.js'

// A page of results; `nextCursor` is null on the last page.
export interface Paginated<T> {
  items: T[]
  nextCursor: null | string
}

// Fields of T that hold a Date, the only sort fields pagination supports.
export type DateField<T> = {
  [Key in keyof T]: T[Key] extends Date ? Key : never
}[keyof T] &
  string

// Builds a page from up to `limit + 1` sorted items; the extra one only
// tells whether a next page exists.
export function toPage<T extends { id: string }>(
  items: T[],
  limit: number,
  sortField: DateField<T>,
): Paginated<T> {
  if (items.length <= limit) return { items, nextCursor: null }

  const page = items.slice(0, limit)
  const last = page.at(-1)!

  return {
    items: page,
    nextCursor: encodeCursor({
      id: last.id,
      value: last[sortField] as Date,
    }),
  }
}
