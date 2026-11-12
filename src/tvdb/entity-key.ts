import type { TvdbEntityType } from './tvdb-entity.js'

// Key of an entity in the run context's seenEntities map.
export function entityKey(type: TvdbEntityType, id: number): string {
  return `${type}:${id}`
}
