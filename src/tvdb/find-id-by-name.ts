import { TvdbLookupError } from './tvdb-lookup.error.js'

// Resolves a genre or status name (any case) to its TVDB id.
export function findIdByName(
  records: { id: number; name: string }[],
  name: string,
  label: string,
): number {
  const record = records.find(
    (candidate) => candidate.name.toLowerCase() === name.toLowerCase(),
  )
  if (record) return record.id

  const validNames = records.map((candidate) => candidate.name).join(', ')

  throw new TvdbLookupError(
    `Unknown ${label} "${name}". Valid values: ${validNames}`,
  )
}
