import type { MessageEntity } from './message.entity.js'

// Storage-agnostic chat entity. Stores map MongoDB's _id to `id`.
export interface ChatEntity {
  createdAt: Date
  id: string
  messages: MessageEntity[]
  updatedAt: Date
  userId: string
  // Optimistic concurrency: every save must match it and increments it.
  version: number
}

// A chat without its messages, for listings.
export type ChatSummaryEntity = Omit<ChatEntity, 'messages'>
