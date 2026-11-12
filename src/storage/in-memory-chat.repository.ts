import { randomUUID } from 'node:crypto'

import type { ChatEntity } from './chat.entity.js'
import type { ChatRepository } from './chat.repository.js'
import type { MessageEntity } from './message.entity.js'

import { ChatConcurrencyError } from './chat-concurrency.error.js'

// Same behaviour as MongoChatRepository, for tests without MongoDB.
export class InMemoryChatRepository implements ChatRepository {
  private readonly chats = new Map<string, ChatEntity>()

  async addMessages(
    chat: Pick<ChatEntity, 'id' | 'version'>,
    messages: MessageEntity[],
  ): Promise<ChatEntity> {
    const stored = this.chats.get(chat.id)
    if (stored?.version !== chat.version) {
      throw new ChatConcurrencyError(chat.id)
    }

    const updated: ChatEntity = {
      ...stored,
      messages: [...stored.messages, ...messages],
      updatedAt: new Date(),
      version: stored.version + 1,
    }
    this.chats.set(chat.id, updated)

    return structuredClone(updated)
  }

  async create(userId: string): Promise<ChatEntity> {
    const now = new Date()
    const chat: ChatEntity = {
      createdAt: now,
      id: randomUUID(),
      messages: [],
      updatedAt: now,
      userId,
      version: 0,
    }
    this.chats.set(chat.id, chat)

    return structuredClone(chat)
  }

  async findById(id: string, userId: string): Promise<ChatEntity | null> {
    const chat = this.chats.get(id)

    return chat?.userId === userId ? structuredClone(chat) : null
  }
}
