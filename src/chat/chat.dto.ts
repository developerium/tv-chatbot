import type { MessageDto } from './message.dto.js'

// A chat with all its messages, oldest first, as returned by
// GET /api/chat/:id.
export interface ChatDto {
  createdAt: string
  id: string
  messages: MessageDto[]
  updatedAt: string
}
