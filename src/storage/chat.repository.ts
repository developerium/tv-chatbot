import type { Model } from 'mongoose'

import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'

import type { Paginated } from '../common/pagination/paginated.js'
import type { PaginationQueryDto } from '../common/pagination/pagination-query.dto.js'
import type { ChatEntity, ChatSummaryEntity } from './chat.entity.js'
import type { MessageEntity } from './message.entity.js'

import { ChatConcurrencyError } from './chat-concurrency.error.js'
import { ChatDocument } from './chat.schema.js'
import { paginate } from './paginate.js'

// The only code that touches the `chat` collection.
@Injectable()
export class ChatRepository {
  constructor(
    @InjectModel(ChatDocument.name)
    private readonly chatModel: Model<ChatDocument>,
  ) {}

  // Appends messages if the chat is still at `version`, otherwise throws
  // ChatConcurrencyError (another write happened first).
  async addMessages(
    chat: Pick<ChatEntity, 'id' | 'version'>,
    messages: MessageEntity[],
  ): Promise<ChatEntity> {
    const updated = await this.chatModel.findOneAndUpdate(
      { _id: chat.id, version: chat.version },
      { $inc: { version: 1 }, $push: { messages: { $each: messages } } },
      { returnDocument: 'after' },
    )

    if (!updated) throw new ChatConcurrencyError(chat.id)

    return updated.toJSON<ChatEntity>()
  }

  async create(userId: string): Promise<ChatEntity> {
    const created = await this.chatModel.create({ userId })

    return created.toJSON<ChatEntity>()
  }

  // Returns null for unknown chats and for chats owned by another user.
  async findById(id: string, userId: string): Promise<ChatEntity | null> {
    const chat = await this.chatModel.findOne({ _id: id, userId })

    return chat?.toJSON<ChatEntity>() ?? null
  }

  // The user's chats without messages, newest first.
  async listByUser(
    userId: string,
    page: PaginationQueryDto,
  ): Promise<Paginated<ChatSummaryEntity>> {
    return paginate<ChatDocument, ChatSummaryEntity>(
      this.chatModel,
      { userId },
      {
        ...page,
        projection: { messages: 0 },
        sortField: 'createdAt',
      },
    )
  }
}
