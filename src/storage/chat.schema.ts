import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { randomUUID } from 'node:crypto'

import type { MessageEntity } from './message.entity.js'

@Schema({ _id: false, versionKey: false })
export class SourceDocument {
  @Prop({ required: true }) name: string
  @Prop({ required: true }) tvdbId: number
  @Prop({ required: true }) type: string
  @Prop({ required: true }) url: string
}

@Schema({ _id: false, versionKey: false })
export class MessageDocument {
  @Prop() clientId?: string
  @Prop({ required: true }) createdAt: Date
  @Prop({ required: true }) id: string
  @Prop() kind?: string
  @Prop() replyTo?: string
  @Prop({ required: true }) role: string
  @Prop({
    default: undefined,
    type: [SchemaFactory.createForClass(SourceDocument)],
  })
  sources?: SourceDocument[]
  @Prop({ required: true }) status: string
  @Prop({ required: true }) text: string
}

@Schema({
  collection: 'chat',
  timestamps: true,
  // Entities expose `id`; `_id` never leaves the store.
  toJSON: {
    transform: (_document, chat: Record<string, unknown>) => {
      chat.id = chat._id
      delete chat._id
    },
  },
  versionKey: false,
})
export class ChatDocument {
  // String ids, not ObjectId, so they compare and serialize as plain strings.
  @Prop({ default: () => randomUUID(), type: String }) _id: string
  createdAt: Date
  @Prop({ default: [], type: [SchemaFactory.createForClass(MessageDocument)] })
  messages: MessageEntity[]
  updatedAt: Date
  @Prop({ index: true, required: true }) userId: string
  @Prop({ default: 0, required: true }) version: number
}

export const ChatSchema = SchemaFactory.createForClass(ChatDocument)
