import type { ChatSummaryEntity } from '../storage/chat.entity.js'
import type { ChatSummaryDto } from './chat-summary.dto.js'

// Only public fields; `userId` and `version` stay internal.
export function toChatSummaryDto(chat: ChatSummaryEntity): ChatSummaryDto {
  return {
    id: chat.id,
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
  }
}
