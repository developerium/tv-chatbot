import { z } from 'zod'

// Position after the last item of a page: its sort value and id
// (tie-breaker for equal sort values).
export interface Cursor {
  id: string
  value: Date
}

const encodedCursorSchema = z.strictObject({
  id: z.uuid(),
  value: z.iso.datetime(),
})

export function encodeCursor({ id, value }: Cursor): string {
  return Buffer.from(
    JSON.stringify({ id, value: value.toISOString() }),
  ).toString('base64url')
}

// Returns null for anything that encodeCursor did not produce.
export function decodeCursor(cursor: string): Cursor | null {
  try {
    const decoded = encodedCursorSchema.safeParse(
      JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')),
    )

    return decoded.success
      ? {
          id: decoded.data.id,
          value: new Date(decoded.data.value),
        }
      : null
  } catch {
    return null
  }
}
