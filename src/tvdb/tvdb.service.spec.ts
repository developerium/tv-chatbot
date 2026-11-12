import { ConfigService } from '@nestjs/config'

import type { TvdbClient } from './tvdb.client.js'

import { TvdbLookupError } from './tvdb-lookup.error.js'
import { TvdbService } from './tvdb.service.js'

const environment = { TVDB_PARALLEL_REQUESTS: '2', TVDB_RESULT_LIMIT: '10' }

// Answers by path prefix, like a tiny fake TVDB.
function createService(responses: Record<string, unknown>) {
  const get = vi.fn(async (path: string) => {
    const match = Object.keys(responses).find((prefix) =>
      path.startsWith(prefix),
    )
    if (!match) throw new Error(`Unexpected path ${path}`)

    return responses[match]
  })
  const client = { get } as unknown as TvdbClient

  return {
    get,
    service: new TvdbService(client, new ConfigService(environment)),
  }
}

const series = (id: number, score: number) => ({
  firstAired: null,
  id,
  name: `Series ${id}`,
  overview: null,
  score,
  status: { id: 1, name: 'Continuing' },
  year: '2020',
})

describe('TvdbService', () => {
  const signal = new AbortController().signal

  it('resolves genre and status names for discovery', async () => {
    const { get, service } = createService({
      '/genres': [{ id: 10, name: 'Fantasy' }],
      '/series/filter': [series(1, 50)],
      '/series/statuses': [{ id: 3, name: 'Upcoming' }],
    })

    const result = await service.discoverSeries('fantasy', 'Upcoming', signal)

    expect(result).toEqual([expect.objectContaining({ id: 1, score: 50 })])
    expect(get).toHaveBeenCalledWith(
      '/series/filter?genre=10&sort=score&sortType=desc&status=3',
      signal,
    )
  })

  it('lists valid genres when the name is unknown', async () => {
    const { service } = createService({
      '/genres': [{ id: 10, name: 'Fantasy' }],
      '/series/statuses': [{ id: 3, name: 'Upcoming' }],
    })

    await expect(
      service.discoverSeries('Cooking', 'Upcoming', signal),
    ).rejects.toThrow(
      new TvdbLookupError('Unknown genre "Cooking". Valid values: Fantasy'),
    )
  })

  it("ranks a network's series by score", async () => {
    const { service } = createService({
      '/search?query=Disney%2B&type=company': [
        {
          country: 'usa',
          name: 'Disney+',
          primary_type: 'Network',
          tvdb_id: '1293',
        },
      ],
      '/search?network=Disney%2B&query=star': [
        { tvdb_id: '1' },
        { tvdb_id: '2' },
        { tvdb_id: '1' },
      ],
      '/series/1': series(1, 10),
      '/series/2': series(2, 90),
    })

    const result = await service.searchByNetwork('Disney+', 'star', signal)

    expect(result.network).toMatchObject({ id: 1293, name: 'Disney+' })
    expect(result.series.map(({ id }) => id)).toEqual([2, 1])
  })
})
