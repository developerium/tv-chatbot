import type { MessageEntity } from '../storage/message.entity.js'

// A user message and the assistant message that answers it.
export interface MessageExchange {
  assistantMessage: MessageEntity
  userMessage: MessageEntity
}
