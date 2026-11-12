import type { SourceEntity } from '../storage/source.entity.js'

// A chat message as returned by the API.
export interface MessageDto {
  // Echoed back so the client can match its pending message.
  clientId?: string
  createdAt: string
  id: string
  kind?: 'answer' | 'clarification' | 'not_found' | 'off_topic'
  replyTo?: string
  role: 'assistant' | 'user'
  sources?: SourceEntity[]
  status: 'complete' | 'failed'
  text: string
}
