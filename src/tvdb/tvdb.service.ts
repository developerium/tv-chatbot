import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type {
  SearchType,
  TvdbGenre,
  TvdbPersonExtended,
  TvdbSearchResult,
  TvdbSeriesBase,
  TvdbSeriesExtended,
  TvdbStatus,
} from './tvdb.types.js'

import { findIdByName } from './find-id-by-name.js'
import { TvdbLookupError } from './tvdb-lookup.error.js'
import { TvdbClient } from './tvdb.client.js'
import {
  toCompanySearchSummary,
  toPersonCredits,
  toPersonSearchSummary,
  toSeriesDetails,
  toSeriesListItem,
  toSeriesSearchSummary,
} from './tvdb.mapper.js'

// Broad terms for listing a network's series when the user gave no topic:
// TVDB search needs a non-empty query (docs/TVDB_API.md).
const BROAD_TERMS = ['a', 'the']

@Injectable()
export class TvdbService {
  private readonly parallelRequests: number
  private readonly resultLimit: number

  constructor(
    private readonly client: TvdbClient,
    config: ConfigService,
  ) {
    const parallelRequests = config.get<string>('TVDB_PARALLEL_REQUESTS')
    const resultLimit = config.get<string>('TVDB_RESULT_LIMIT')

    if (!parallelRequests || !resultLimit) {
      throw new Error(
        'TVDB_PARALLEL_REQUESTS and TVDB_RESULT_LIMIT must be set',
      )
    }

    this.parallelRequests = Number(parallelRequests)
    this.resultLimit = Number(resultLimit)
  }

  async search(query: string, type: SearchType, signal: AbortSignal) {
    const results = await this.searchRaw({ query, type }, signal)

    if (type === 'series') return results.map(toSeriesSearchSummary)
    if (type === 'person') return results.map(toPersonSearchSummary)

    return results.map(toCompanySearchSummary)
  }

  async getSeriesDetails(seriesId: number, signal: AbortSignal) {
    const series = await this.client.get<TvdbSeriesExtended>(
      `/series/${seriesId}/extended`,
      signal,
    )

    return toSeriesDetails(series)
  }

  async getPersonCredits(personId: number, signal: AbortSignal) {
    const person = await this.client.get<TvdbPersonExtended>(
      `/people/${personId}/extended`,
      signal,
    )

    return toPersonCredits(person)
  }

  // Top series by score for a genre and status, e.g. upcoming fantasy.
  async discoverSeries(genre: string, status: string, signal: AbortSignal) {
    const [genres, statuses] = await Promise.all([
      this.client.get<TvdbGenre[]>('/genres', signal),
      this.client.get<TvdbStatus[]>('/series/statuses', signal),
    ])

    const genreId = findIdByName(genres, genre, 'genre')
    const statusId = findIdByName(statuses, status, 'status')

    const parameters = new URLSearchParams({
      genre: String(genreId),
      sort: 'score',
      sortType: 'desc',
      status: String(statusId),
    })
    const series = await this.client.get<TvdbSeriesBase[]>(
      `/series/filter?${parameters}`,
      signal,
    )

    return series.slice(0, this.resultLimit).map(toSeriesListItem)
  }

  // /series/filter?company= returns nothing, so network listings use search
  // and rank the candidates by score (see "Series on a network").
  async searchByNetwork(
    networkName: string,
    query: null | string,
    signal: AbortSignal,
  ) {
    const [network] = await this.searchRaw(
      { query: networkName, type: 'company' },
      signal,
    )
    if (!network) {
      throw new TvdbLookupError(`TVDB has no network named "${networkName}"`)
    }

    const candidates = new Map<string, TvdbSearchResult>()

    for (const term of query ? [query] : BROAD_TERMS) {
      const results = await this.searchRaw(
        { network: network.name, query: term, type: 'series' },
        signal,
      )

      for (const result of results) candidates.set(result.tvdb_id, result)
    }

    const ids = [...candidates.keys()].slice(0, this.resultLimit)
    const series: TvdbSeriesBase[] = []

    for (let index = 0; index < ids.length; index += this.parallelRequests) {
      const batch = ids.slice(index, index + this.parallelRequests)

      series.push(
        ...(await Promise.all(
          batch.map((id) =>
            this.client.get<TvdbSeriesBase>(`/series/${id}`, signal),
          ),
        )),
      )
    }

    return {
      network: toCompanySearchSummary(network),
      series: series
        .sort((first, second) => second.score - first.score)
        .map(toSeriesListItem),
    }
  }

  private searchRaw(
    parameters: Record<string, string>,
    signal: AbortSignal,
  ): Promise<TvdbSearchResult[]> {
    const query = new URLSearchParams({
      ...parameters,
      limit: String(this.resultLimit),
    })

    return this.client.get<TvdbSearchResult[]>(`/search?${query}`, signal)
  }
}
