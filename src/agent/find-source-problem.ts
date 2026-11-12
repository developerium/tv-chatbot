import type { TvdbRunContext } from '../tvdb/tvdb-entity.js'
import type { FinalAnswer } from './final-answer.js'

import { entityKey } from '../tvdb/entity-key.js'

// Describes what is wrong with the answer's sources, or undefined if they
// are all entities a tool returned. An answer must cite at least one.
export function findSourceProblem(
  answer: FinalAnswer,
  context: TvdbRunContext,
): string | undefined {
  if (answer.kind !== 'answer') return undefined
  if (answer.sources.length === 0) return 'Your answer cited no sources'

  const unknown = answer.sources
    .filter(
      (source) => !context.seenEntities.has(entityKey(source.type, source.id)),
    )
    .map((source) => `${source.type} ${source.id}`)

  return unknown.length > 0
    ? `Your answer cited ${unknown.join(', ')}, which no TVDB tool returned`
    : undefined
}
