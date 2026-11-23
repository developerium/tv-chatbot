import { z } from 'zod'

import { decodeCursor } from './cursor.js'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100
const MAX_CURSOR_LENGTH = 200

// Query string of every listing endpoint; a bad cursor is a 400.
export const paginationQuerySchema = z.strictObject({
  cursor: z
    .string()
    .max(MAX_CURSOR_LENGTH)
    .transform((value, context) => {
      const cursor = decodeCursor(value)
      if (!cursor) {
        context.addIssue({ code: 'custom', message: 'Invalid cursor' })

        return z.NEVER
      }

      return cursor
    })
    .optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
})

export type PaginationQueryDto = z.infer<typeof paginationQuerySchema>
