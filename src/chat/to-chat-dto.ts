import type { ChatEntity } from '../storage/chat.entity.js'
import type { ChatDto } from './chat.dto.js'

import { toMessageDto } from './to-message-dto.js'

// Only public fields; `userId` and `version` stay internal.
export function toChatDto(chat: ChatEntity): ChatDto {
  return {
    id: chat.id,
    createdAt: chat.createdAt.toISOString(),
    messages: chat.messages.map((message) => toMessageDto(message)),
    updatedAt: chat.updatedAt.toISOString(),
  }
}
