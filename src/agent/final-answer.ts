import { z } from 'zod'

import type { TvdbEntityType } from '../tvdb/tvdb-entity.js'

// The agent's structured output; the model can't end a turn with free text.
export const finalAnswerSchema = z.object({
  kind: z.enum(['answer', 'clarification', 'not_found', 'off_topic']),
  message: z.string(),
  // TVDB entities the answer is based on; empty unless kind is "answer".
  sources: z.array(
    z.object({
      id: z.number().int().positive(),
      type: z.enum(['company', 'person', 'series']),
    }),
  ),
})

export type FinalAnswer = z.infer<typeof finalAnswerSchema>

// What callers get: sources are filled in by code from TVDB tool results.
export interface AgentReply {
  kind: FinalAnswer['kind']
  message: string
  sources: { id: number; name: string; type: TvdbEntityType; url: string }[]
}

export const OFF_TOPIC_REPLY =
  'I can only help with TV series and movies, for example recommendations, cast, genres or networks.'

export const NOT_GROUNDED_REPLY =
  "I couldn't back this answer with TVDB data. Please try rephrasing the question."
