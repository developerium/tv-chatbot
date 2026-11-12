import { ConfigService } from '@nestjs/config'
import { RunContext } from '@openai/agents'

import type { TvdbRunContext } from './tvdb-entity.js'
import type { TvdbService } from './tvdb.service.js'

import { HttpError } from '../common/http-error.js'
import { TvdbTools } from './tvdb.tools.js'

const config = new ConfigService({ TVDB_TOOL_TIMEOUT_MS: '20000' })

function createTools(service: Partial<TvdbService>) {
  const tools = new TvdbTools(service as TvdbService, config).tools
  const context = new RunContext<TvdbRunContext>({ seenEntities: new Map() })

  const invoke = (name: string, input: unknown) =>
    tools
      .find((tool) => tool.name === name)!
      .invoke(context as never, JSON.stringify(input))

  return { context, invoke }
}

describe('TvdbTools', () => {
  it('records the series, networks and cast a tool returned', async () => {
    const { context, invoke } = createTools({
      getSeriesDetails: vi.fn().mockResolvedValue({
        companies: [],
        id: 81_189,
        latestNetwork: null,
        mainCast: [
          {
            character: 'Walter White',
            personId: 255_211,
            personName: 'Bryan Cranston',
          },
        ],
        name: 'Breaking Bad',
        originalNetwork: { country: 'usa', id: 389, name: 'AMC' },
      }),
    })

    await invoke('get_series_details', { seriesId: 81_189 })

    expect([...context.context.seenEntities.keys()].sort()).toEqual([
      'company:389',
      'person:255211',
      'series:81189',
    ])
  })

  it('tells the model when TVDB has no record', async () => {
    const { context, invoke } = createTools({
      getSeriesDetails: vi
        .fn()
        .mockRejectedValue(new HttpError(404, 'Not found')),
    })

    await expect(invoke('get_series_details', { seriesId: 1 })).resolves.toBe(
      'TVDB has no record with this id.',
    )
    expect(context.context.seenEntities.size).toBe(0)
  })
})
