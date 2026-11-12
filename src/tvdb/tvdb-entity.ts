import type { RunContext } from '@openai/agents'

export type TvdbEntityType = 'company' | 'person' | 'series'

export interface TvdbEntity {
  id: number
  name: string
  type: TvdbEntityType
}

// Agent run context: every entity a TVDB tool returned during the turn.
// The grounding check only accepts sources found here.
export interface TvdbRunContext {
  seenEntities: Map<string, TvdbEntity>
}

// Tool execute functions receive the run context only when run by an agent.
export type TvdbToolContext = RunContext<TvdbRunContext> | undefined
