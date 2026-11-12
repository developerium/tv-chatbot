import { z } from 'zod'

// Path parameter `:id` of chat routes; chat ids are UUIDs.
export const chatIdSchema = z.uuid()
