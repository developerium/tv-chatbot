import { type AgentInputItem, assistant, user } from '@openai/agents'

import type { MessageEntity } from '../storage/message.entity.js'

// An earlier chat message as model input. Assistant messages list their
// sources so follow-ups ("the second one") can refer to their TVDB ids.
export function toAgentInput(message: MessageEntity): AgentInputItem {
  if (message.role === 'user') return user(message.text)

  const sources = (message.sources ?? [])
    .map((source) => `${source.name} (${source.type} ${source.tvdbId})`)
    .join(', ')

  return assistant(
    sources ? `${message.text}\n\nSources: ${sources}` : message.text,
  )
}
