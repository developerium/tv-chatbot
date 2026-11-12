import type { ChatEntity } from './chat.entity.js'
import type { MessageEntity } from './message.entity.js'

export const CHAT_REPOSITORY = Symbol('CHAT_REPOSITORY')

export interface ChatRepository {
  // Appends messages if the chat is still at `version`, otherwise throws
  // ChatConcurrencyError (another write happened first).
  addMessages(
    chat: Pick<ChatEntity, 'id' | 'version'>,
    messages: MessageEntity[],
  ): Promise<ChatEntity>

  create(userId: string): Promise<ChatEntity>

  // Returns null for unknown chats and for chats owned by another user.
  findById(id: string, userId: string): Promise<ChatEntity | null>
}
