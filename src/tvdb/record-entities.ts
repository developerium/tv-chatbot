import type { TvdbEntity, TvdbToolContext } from './tvdb-entity.js'

import { entityKey } from './entity-key.js'

// Marks entities as returned by a tool, for the grounding check.
export function recordEntities(
  context: TvdbToolContext,
  entities: TvdbEntity[],
): void {
  for (const entity of entities) {
    context?.context.seenEntities.set(entityKey(entity.type, entity.id), entity)
  }
}
