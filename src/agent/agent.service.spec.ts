import { ConfigService } from '@nestjs/config'
import { assistant, user } from '@openai/agents'

import type { MessageEntity } from '../storage/message.entity.js'
import type { TvdbRunContext } from '../tvdb/tvdb-entity.js'
import type { TvdbTools } from '../tvdb/tvdb.tools.js'

import { AgentService } from './agent.service.js'
import {
  type FinalAnswer,
  NOT_GROUNDED_REPLY,
  OFF_TOPIC_REPLY,
} from './final-answer.js'

const environment = {
  AGENT_HISTORY_LIMIT: '20',
  AGENT_MAX_TURNS: '8',
  OPENAI_API_KEY: 'test-key',
  OPENAI_MAX_RETRIES: '3',
  OPENAI_MODEL: 'test-model',
  OPENAI_TIMEOUT_MS: '60000',
}
const tvdbTools = { tools: [] } as unknown as TvdbTools

const betterCallSaul = {
  id: 273_181,
  name: 'Better Call Saul',
  type: 'series' as const,
}
const recommendation: FinalAnswer = {
  kind: 'answer',
  message: 'Try Better Call Saul.',
  sources: [{ id: 273_181, type: 'series' }],
}

// Each scripted run can mark Better Call Saul as returned by a tool.
function createService(
  runs: { answer: FinalAnswer | undefined; toolReturnsSaul: boolean }[],
) {
  const service = new AgentService(new ConfigService(environment), tvdbTools)
  const run = vi.spyOn(service['runner'], 'run')

  for (const { answer, toolReturnsSaul } of runs) {
    run.mockImplementationOnce((async (
      _agent: unknown,
      _input: unknown,
      options: { context: TvdbRunContext },
    ) => {
      if (toolReturnsSaul) {
        options.context.seenEntities.set('series:273181', betterCallSaul)
      }

      return { finalOutput: answer, history: [] }
    }) as never)
  }

  return { run, service }
}

describe('AgentService', () => {
  const signal = new AbortController().signal

  it.each(Object.keys(environment))('throws when %s is missing', (name) => {
    const config = new ConfigService({ ...environment, [name]: '' })

    expect(() => new AgentService(config, tvdbTools)).toThrow('must be set')
  })

  it('returns a grounded answer with sources built from tool results', async () => {
    const { run, service } = createService([
      { answer: recommendation, toolReturnsSaul: true },
    ])

    await expect(
      service.chat([], 'Like Breaking Bad', signal),
    ).resolves.toEqual({
      kind: 'answer',
      message: 'Try Better Call Saul.',
      sources: [
        {
          ...betterCallSaul,
          url: 'https://thetvdb.com/dereferrer/series/273181',
        },
      ],
    })
    expect(run).toHaveBeenCalledWith(
      expect.anything(),
      [user('Like Breaking Bad')],
      { context: expect.anything(), maxTurns: 8, signal },
    )
  })

  it('sends an ungrounded answer back once for correction', async () => {
    const { run, service } = createService([
      { answer: recommendation, toolReturnsSaul: false },
      { answer: recommendation, toolReturnsSaul: true },
    ])

    const reply = await service.chat([], 'Like Breaking Bad', signal)

    expect(reply.kind).toBe('answer')
    expect(run).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(run.mock.calls[1][1])).toContain(
      'Your answer cited series 273181, which no TVDB tool returned',
    )
  })

  it('returns not_found when the answer stays ungrounded', async () => {
    const { service } = createService([
      { answer: recommendation, toolReturnsSaul: false },
      { answer: { ...recommendation, sources: [] }, toolReturnsSaul: false },
    ])

    await expect(
      service.chat([], 'Like Breaking Bad', signal),
    ).resolves.toEqual({
      kind: 'not_found',
      message: NOT_GROUNDED_REPLY,
      sources: [],
    })
  })

  it('replaces off-topic text with the fixed reply', async () => {
    const { service } = createService([
      {
        answer: { kind: 'off_topic', message: 'Cake recipe', sources: [] },
        toolReturnsSaul: false,
      },
    ])

    await expect(service.chat([], 'Cake recipe?', signal)).resolves.toEqual({
      kind: 'off_topic',
      message: OFF_TOPIC_REPLY,
      sources: [],
    })
  })

  it('sends history and accepts sources cited in earlier answers', async () => {
    const history: MessageEntity[] = [
      {
        createdAt: new Date(),
        id: 'message-1',
        role: 'user',
        status: 'complete',
        text: 'Like Breaking Bad',
      },
      {
        createdAt: new Date(),
        id: 'message-2',
        kind: 'answer',
        role: 'assistant',
        sources: [
          {
            name: 'Better Call Saul',
            tvdbId: 273_181,
            type: 'series',
            url: 'https://thetvdb.com/dereferrer/series/273181',
          },
        ],
        status: 'complete',
        text: 'Try Better Call Saul.',
      },
    ]
    const { run, service } = createService([
      { answer: recommendation, toolReturnsSaul: false },
    ])

    const reply = await service.chat(history, 'Tell me more about it', signal)

    expect(reply.kind).toBe('answer')
    expect(run).toHaveBeenCalledTimes(1)
    expect(run.mock.calls[0][1]).toEqual([
      user('Like Breaking Bad'),
      assistant(
        'Try Better Call Saul.\n\nSources: Better Call Saul (series 273181)',
      ),
      user('Tell me more about it'),
    ])
  })

  it('throws when the run has no final answer', async () => {
    const { service } = createService([
      { answer: undefined, toolReturnsSaul: false },
    ])

    await expect(service.chat([], 'Hi', signal)).rejects.toThrow(
      'without a final answer',
    )
  })
})
