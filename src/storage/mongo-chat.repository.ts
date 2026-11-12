import type { Model } from 'mongoose'

import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'

import type { ChatEntity } from './chat.entity.js'
import type { ChatRepository } from './chat.repository.js'
import type { MessageEntity } from './message.entity.js'

import { ChatConcurrencyError } from './chat-concurrency.error.js'
import { ChatDocument } from './chat.schema.js'

// The only code that touches the `chat` collection.
@Injectable()
export class MongoChatRepository implements ChatRepository {
  constructor(
    @InjectModel(ChatDocument.name) private readonly chats: Model<ChatDocument>,
  ) {}

  async addMessages(
    chat: Pick<ChatEntity, 'id' | 'version'>,
    messages: MessageEntity[],
  ): Promise<ChatEntity> {
    const updated = await this.chats.findOneAndUpdate(
      { _id: chat.id, version: chat.version },
      { $inc: { version: 1 }, $push: { messages: { $each: messages } } },
      { returnDocument: 'after' },
    )

    if (!updated) throw new ChatConcurrencyError(chat.id)

    return updated.toJSON<ChatEntity>()
  }

  async create(userId: string): Promise<ChatEntity> {
    const created = await this.chats.create({ userId })

    return created.toJSON<ChatEntity>()
  }

  async findById(id: string, userId: string): Promise<ChatEntity | null> {
    const chat = await this.chats.findOne({ _id: id, userId })

    return chat?.toJSON<ChatEntity>() ?? null
  }
}
