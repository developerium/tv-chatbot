import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { tool } from '@openai/agents'
import { z } from 'zod'

import type { TvdbToolContext } from './tvdb-entity.js'

import { describeToolError } from './describe-tool-error.js'
import { recordEntities } from './record-entities.js'
import { toolSignal } from './tool-signal.js'
import { TvdbService } from './tvdb.service.js'

// The agent's TVDB tools. Each records the entities it returned, so the
// grounding check can tell which ids came from TVDB.
@Injectable()
export class TvdbTools {
  readonly tools

  private readonly timeoutMs: number

  constructor(
    private readonly tvdb: TvdbService,
    config: ConfigService,
  ) {
    const timeoutMs = config.get<string>('TVDB_TOOL_TIMEOUT_MS')
    if (!timeoutMs) throw new Error('TVDB_TOOL_TIMEOUT_MS must be set')

    this.timeoutMs = Number(timeoutMs)
    this.tools = [
      this.searchTool(),
      this.seriesDetailsTool(),
      this.personCreditsTool(),
      this.discoverSeriesTool(),
      this.networkSeriesTool(),
    ]
  }

  private searchTool() {
    return tool({
      description:
        'Search TVDB by name to find the ids of series, people or companies (networks, studios).',
      errorFunction: describeToolError,
      execute: async ({ query, type }, context?: TvdbToolContext, details?) => {
        const results = await this.tvdb.search(query, type, toolSignal(details))

        recordEntities(
          context,
          results.map(({ id, name }) => ({ id, name, type })),
        )

        return results
      },
      name: 'search_tvdb',
      parameters: z.object({
        query: z.string().min(1),
        type: z.enum(['company', 'person', 'series']),
      }),
      timeoutMs: this.timeoutMs,
    })
  }

  private seriesDetailsTool() {
    return tool({
      description:
        'Get a series by TVDB id: overview, genres, status, air dates, networks, companies and main cast.',
      errorFunction: describeToolError,
      execute: async ({ seriesId }, context?: TvdbToolContext, details?) => {
        const series = await this.tvdb.getSeriesDetails(
          seriesId,
          toolSignal(details),
        )

        const companies = [
          series.originalNetwork,
          series.latestNetwork,
          ...series.companies,
        ].flatMap((company) =>
          company
            ? [{ id: company.id, name: company.name, type: 'company' as const }]
            : [],
        )
        const cast = series.mainCast.map((member) => ({
          id: member.personId,
          name: member.personName ?? 'Unknown',
          type: 'person' as const,
        }))

        recordEntities(context, [
          { id: series.id, name: series.name, type: 'series' },
          ...companies,
          ...cast,
        ])

        return series
      },
      name: 'get_series_details',
      parameters: z.object({ seriesId: z.number().int().positive() }),
      timeoutMs: this.timeoutMs,
    })
  }

  private personCreditsTool() {
    return tool({
      description:
        "Get a person's acting roles in series by TVDB person id (guest roles and movies left out).",
      errorFunction: describeToolError,
      execute: async ({ personId }, context?: TvdbToolContext, details?) => {
        const person = await this.tvdb.getPersonCredits(
          personId,
          toolSignal(details),
        )

        recordEntities(context, [
          { id: person.id, name: person.name, type: 'person' },
          ...person.series.map(({ id, name }) => ({
            id,
            name,
            type: 'series' as const,
          })),
        ])

        return person
      },
      name: 'get_person_credits',
      parameters: z.object({ personId: z.number().int().positive() }),
      timeoutMs: this.timeoutMs,
    })
  }

  private discoverSeriesTool() {
    return tool({
      description:
        'List the most popular series for a genre and status, e.g. upcoming fantasy series. Genre is a TVDB genre name such as "Fantasy" or "Drama".',
      errorFunction: describeToolError,
      execute: async (
        { genre, status },
        context?: TvdbToolContext,
        details?,
      ) => {
        const series = await this.tvdb.discoverSeries(
          genre,
          status,
          toolSignal(details),
        )

        recordEntities(
          context,
          series.map(({ id, name }) => ({ id, name, type: 'series' as const })),
        )

        return series
      },
      name: 'discover_series',
      parameters: z.object({
        genre: z.string().min(1),
        status: z.enum(['Continuing', 'Ended', 'Upcoming']),
      }),
      timeoutMs: this.timeoutMs,
    })
  }

  private networkSeriesTool() {
    return tool({
      description:
        'List series TVDB records for a network (e.g. "Disney+"), most popular first. Pass a topic as query to narrow it, or null for a general list. Results only cover titles matching the search, not everything on the network.',
      errorFunction: describeToolError,
      execute: async (
        { network, query },
        context?: TvdbToolContext,
        details?,
      ) => {
        const result = await this.tvdb.searchByNetwork(
          network,
          query,
          toolSignal(details),
        )

        recordEntities(context, [
          { id: result.network.id, name: result.network.name, type: 'company' },
          ...result.series.map(({ id, name }) => ({
            id,
            name,
            type: 'series' as const,
          })),
        ])

        return result
      },
      name: 'search_by_network',
      parameters: z.object({
        network: z.string().min(1),
        query: z.string().min(1).nullable(),
      }),
      timeoutMs: this.timeoutMs,
    })
  }
}
