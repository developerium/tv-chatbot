import { ConfigService } from '@nestjs/config'

import type { AgentReply } from '../agent/final-answer.js'

import { AgentService } from '../agent/agent.service.js'
import { InMemoryChatRepository } from '../storage/in-memory-chat.repository.js'
import { AssistantUnavailableError } from './assistant-unavailable.error.js'
import { ChatService } from './chat.service.js'
import { TurnTimeoutError } from './turn-timeout.error.js'

const reply: AgentReply = {
  kind: 'answer',
  message: 'Try Better Call Saul.',
  sources: [
    {
      id: 273_181,
      name: 'Better Call Saul',
      type: 'series',
      url: 'https://thetvdb.com/dereferrer/series/273181',
    },
  ],
}

function createService(chat: AgentService['chat']) {
  const repository = new InMemoryChatRepository()
  const agent = { chat: vi.fn(chat) }
  const config = new ConfigService({ AGENT_TURN_TIMEOUT_MS: '50' })
  const service = new ChatService(
    repository,
    agent as unknown as AgentService,
    config,
  )

  return { agent, repository, service }
}

describe('ChatService.sendMessage', () => {
  it('saves the question and the answer with its sources', async () => {
    const { agent, repository, service } = createService(async () => reply)
    const chat = await repository.create('user-1')

    const result = await service.sendMessage(chat.id, 'user-1', {
      text: 'Like Breaking Bad',
    })

    expect(result?.assistantMessage).toMatchObject({
      kind: 'answer',
      replyTo: result?.userMessage.id,
      sources: [{ name: 'Better Call Saul', tvdbId: 273_181, type: 'series' }],
      text: 'Try Better Call Saul.',
    })
    expect(agent.chat).toHaveBeenCalledWith(
      [],
      'Like Breaking Bad',
      expect.any(AbortSignal),
    )

    const saved = await repository.findById(chat.id, 'user-1')
    expect(saved?.messages).toEqual([
      result?.userMessage,
      result?.assistantMessage,
    ])
  })

  it('passes earlier messages as history', async () => {
    const { agent, repository, service } = createService(async () => reply)
    const chat = await repository.create('user-1')
    const first = await service.sendMessage(chat.id, 'user-1', {
      text: 'Like Breaking Bad',
    })

    await service.sendMessage(chat.id, 'user-1', { text: 'Tell me more' })

    expect(agent.chat).toHaveBeenLastCalledWith(
      [first?.userMessage, first?.assistantMessage],
      'Tell me more',
      expect.any(AbortSignal),
    )
  })

  it("returns null for another user's chat", async () => {
    const { agent, repository, service } = createService(async () => reply)
    const chat = await repository.create('user-1')

    await expect(
      service.sendMessage(chat.id, 'user-2', { text: 'Hi' }),
    ).resolves.toBeNull()
    expect(agent.chat).not.toHaveBeenCalled()
  })

  it('keeps the question and throws TurnTimeoutError when the turn times out', async () => {
    const { repository, service } = createService(
      (_history, _message, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason))
        }),
    )
    const chat = await repository.create('user-1')

    await expect(
      service.sendMessage(chat.id, 'user-1', { text: 'Hi' }),
    ).rejects.toThrow(TurnTimeoutError)

    const saved = await repository.findById(chat.id, 'user-1')
    expect(saved?.messages.map(({ role }) => role)).toEqual(['user'])
  })

  it('throws AssistantUnavailableError when the agent fails', async () => {
    const { repository, service } = createService(async () => {
      throw new Error('429 You have no credits remaining')
    })
    const chat = await repository.create('user-1')

    await expect(
      service.sendMessage(chat.id, 'user-1', { text: 'Hi' }),
    ).rejects.toThrow(AssistantUnavailableError)
  })

  describe('with a clientId', () => {
    const clientId = '6f1c9a52-3d0b-4c7e-9f45-2a8d1e7b6c30'

    it('returns the saved answer for a repeated clientId without a new turn', async () => {
      const { agent, repository, service } = createService(async () => reply)
      const chat = await repository.create('user-1')

      const first = await service.sendMessage(chat.id, 'user-1', {
        clientId,
        text: 'Like Breaking Bad',
      })
      const second = await service.sendMessage(chat.id, 'user-1', {
        clientId,
        text: 'Like Breaking Bad',
      })

      expect(second).toEqual(first)
      expect(first?.userMessage.clientId).toBe(clientId)
      expect(agent.chat).toHaveBeenCalledTimes(1)

      const saved = await repository.findById(chat.id, 'user-1')
      expect(saved?.messages).toHaveLength(2)
    })

    it('answers the saved question again when the earlier turn failed', async () => {
      const { agent, repository, service } = createService(async () => reply)
      const chat = await repository.create('user-1')
      agent.chat.mockRejectedValueOnce(new Error('OpenAI is down'))

      await expect(
        service.sendMessage(chat.id, 'user-1', { clientId, text: 'Hi' }),
      ).rejects.toThrow(AssistantUnavailableError)
      const retry = await service.sendMessage(chat.id, 'user-1', {
        clientId,
        text: 'Hi',
      })

      expect(retry?.assistantMessage.replyTo).toBe(retry?.userMessage.id)
      expect(agent.chat).toHaveBeenLastCalledWith(
        [],
        'Hi',
        expect.any(AbortSignal),
      )

      const saved = await repository.findById(chat.id, 'user-1')

      expect(saved?.messages).toHaveLength(2)
      expect(saved?.messages[0].role).toBe('user')
      expect(saved?.messages[1].role).toBe('assistant')
    })
  })
})
