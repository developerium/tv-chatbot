import { z } from 'zod'

const MAX_MESSAGE_LENGTH = 2000

// Request body of POST /api/chat/:id/message.
export const sendMessageSchema = z.strictObject({
  // Optional client-generated id; resending it returns the saved answer.
  clientId: z.uuid().optional(),
  text: z
    .string()
    // Control characters except newline and tab.
    .transform((text) => text.replaceAll(/[^\P{Cc}\n\t]/gu, '').trim())
    .pipe(z.string().min(1).max(MAX_MESSAGE_LENGTH)),
})

export type SendMessageDto = z.infer<typeof sendMessageSchema>
