import type { MessageDto } from './message.dto.js'

// Response of POST /api/chat/:id/message.
export interface MessageSentDto {
  assistantMessage: MessageDto
  userMessage: MessageDto
}
