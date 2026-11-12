import type { TvdbEntity, TvdbEntityType } from './tvdb-entity.js'

const URL_PATHS: Record<TvdbEntityType, string> = {
  company: 'company',
  person: 'people',
  series: 'series',
}

// TVDB redirects these id-based links to the entity's page.
export function entityUrl({ id, type }: TvdbEntity): string {
  return `https://thetvdb.com/dereferrer/${URL_PATHS[type]}/${id}`
}
