import type { SourceEntity } from './source.entity.js'

export interface MessageEntity {
  // User messages only: optional client-sent UUID for deduplication.
  clientId?: string
  createdAt: Date
  // Always server-generated; the only id used to reference messages.
  id: string
  // Assistant messages only.
  kind?: 'answer' | 'clarification' | 'not_found' | 'off_topic'
  // Assistant messages only: id of the user message it answers.
  replyTo?: string
  role: 'assistant' | 'user'
  // Assistant messages only; copied by code from TVDB tool results.
  sources?: SourceEntity[]
  status: 'complete' | 'failed'
  text: string
}
