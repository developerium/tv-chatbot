import type { MessageEntity } from '../storage/message.entity.js'
import type { MessageDto } from './message.dto.js'

export function toMessageDto(message: MessageEntity): MessageDto {
  return { ...message, createdAt: message.createdAt.toISOString() }
}
