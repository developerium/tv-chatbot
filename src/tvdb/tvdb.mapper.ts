// Turns raw TVDB records into the compact summaries the tools return.

import type {
  TvdbCompany,
  TvdbPersonExtended,
  TvdbSearchResult,
  TvdbSeriesBase,
  TvdbSeriesExtended,
} from './tvdb.types.js'

export function toSeriesSearchSummary(result: TvdbSearchResult) {
  return {
    country: result.country,
    id: Number(result.tvdb_id),
    name: result.name,
    network: result.network,
    overview: result.overview,
    status: result.status,
    year: result.year,
  }
}

export function toPersonSearchSummary(result: TvdbSearchResult) {
  return { id: Number(result.tvdb_id), name: result.name }
}

export function toCompanySearchSummary(result: TvdbSearchResult) {
  return {
    country: result.country,
    id: Number(result.tvdb_id),
    name: result.name,
    primaryType: result.primary_type,
  }
}

export function toSeriesListItem(series: TvdbSeriesBase) {
  return {
    firstAired: series.firstAired,
    id: series.id,
    name: series.name,
    overview: series.overview,
    score: series.score,
    status: series.status?.name ?? null,
    year: series.year,
  }
}

export function toSeriesDetails(series: TvdbSeriesExtended) {
  const mainCast = (series.characters ?? [])
    .filter(
      (character) => character.isFeatured && character.peopleType === 'Actor',
    )
    .sort((first, second) => first.sort - second.sort)
    .map((character) => ({
      character: character.name,
      personId: character.peopleId,
      personName: character.personName,
    }))

  return {
    averageRuntime: series.averageRuntime,
    companies: (series.companies ?? []).map((company) => ({
      country: company.country,
      id: company.id,
      name: company.name,
      type: company.companyType?.companyTypeName ?? null,
    })),
    firstAired: series.firstAired,
    genres: (series.genres ?? []).map((genre) => genre.name),
    id: series.id,
    lastAired: series.lastAired,
    latestNetwork: toCompanyReference(series.latestNetwork),
    mainCast,
    name: series.name,
    nextAired: series.nextAired || null,
    originalCountry: series.originalCountry,
    originalLanguage: series.originalLanguage,
    originalNetwork: toCompanyReference(series.originalNetwork),
    overview: series.overview,
    score: series.score,
    status: series.status?.name ?? null,
    year: series.year,
  }
}

// Acting credits on series only; guest roles and movies are left out.
export function toPersonCredits(person: TvdbPersonExtended) {
  const series = new Map<
    number,
    { character: null | string; id: number; name: string; year: null | string }
  >()

  for (const credit of person.characters ?? []) {
    const isSeriesRole = credit.peopleType === 'Actor' && credit.seriesId
    if (!isSeriesRole || series.has(credit.seriesId!)) continue

    series.set(credit.seriesId!, {
      character: credit.name,
      id: credit.seriesId!,
      name: credit.series?.name ?? 'Unknown',
      year: credit.series?.year ?? null,
    })
  }

  return {
    birth: person.birth,
    death: person.death,
    id: person.id,
    name: person.name,
    series: [...series.values()],
  }
}

function toCompanyReference(company: null | TvdbCompany) {
  return company
    ? { country: company.country, id: company.id, name: company.name }
    : null
}

export type SeriesDetails = ReturnType<typeof toSeriesDetails>
export type PersonCredits = ReturnType<typeof toPersonCredits>
export type SeriesListItem = ReturnType<typeof toSeriesListItem>
