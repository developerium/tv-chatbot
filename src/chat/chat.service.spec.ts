import { ConfigService } from '@nestjs/config'

import type { AgentReply } from '../agent/final-answer.js'
import type { ChatEntity } from '../storage/chat.entity.js'
import type { ChatRepository } from '../storage/chat.repository.js'
import type { MessageEntity } from '../storage/message.entity.js'

import { AgentService } from '../agent/agent.service.js'
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

const clientId = '6f1c9a52-3d0b-4c7e-9f45-2a8d1e7b6c30'

const question: MessageEntity = {
  clientId,
  createdAt: new Date('2026-11-09T10:00:00Z'),
  id: 'question',
  role: 'user',
  status: 'complete',
  text: 'Like Breaking Bad',
}
const answer: MessageEntity = {
  createdAt: new Date('2026-11-09T10:00:05Z'),
  id: 'answer',
  kind: 'answer',
  replyTo: 'question',
  role: 'assistant',
  sources: [],
  status: 'complete',
  text: 'Try Better Call Saul.',
}

function chatWith(messages: MessageEntity[]): ChatEntity {
  return {
    createdAt: new Date('2026-11-09T09:00:00Z'),
    id: 'chat-1',
    messages,
    updatedAt: new Date('2026-11-09T09:00:00Z'),
    userId: 'user-1',
    version: 0,
  }
}

// `chat` is what findById returns; addMessages appends to the given chat.
function createService(
  chat: ChatEntity | null,
  agentChat: AgentService['chat'] = async () => reply,
) {
  const repository = {
    addMessages: vi.fn<ChatRepository['addMessages']>(
      async (saved, messages) => ({
        ...chat!,
        messages: [...chat!.messages, ...messages],
        version: saved.version + 1,
      }),
    ),
    create: vi.fn<ChatRepository['create']>(),
    findById: vi.fn<ChatRepository['findById']>(async () => chat),
    listByUser: vi.fn<ChatRepository['listByUser']>(),
  }
  const agent = { chat: vi.fn(agentChat) }
  const config = new ConfigService({ AGENT_TURN_TIMEOUT_MS: '50' })
  const service = new ChatService(
    repository,
    agent as unknown as AgentService,
    config,
  )

  return { agent, repository, service }
}

describe('ChatService.listChats', () => {
  it("returns the repository's page of the user's chats", async () => {
    const { repository, service } = createService(null)
    const page = { items: [], nextCursor: null }
    repository.listByUser.mockResolvedValue(page)

    await expect(service.listChats('user-1', { limit: 5 })).resolves.toBe(page)
    expect(repository.listByUser).toHaveBeenCalledWith('user-1', { limit: 5 })
  })
})

describe('ChatService.getChat', () => {
  it("returns the user's chat with its messages", async () => {
    const chat = chatWith([question, answer])
    const { repository, service } = createService(chat)

    await expect(service.getChat('chat-1', 'user-1')).resolves.toBe(chat)
    expect(repository.findById).toHaveBeenCalledWith('chat-1', 'user-1')
  })

  it('returns null when the user has no such chat', async () => {
    const { service } = createService(null)

    await expect(service.getChat('chat-1', 'user-1')).resolves.toBeNull()
  })
})

describe('ChatService.sendMessage', () => {
  it('saves the question, then the answer with its sources', async () => {
    const { agent, repository, service } = createService(chatWith([]))

    const result = await service.sendMessage('chat-1', 'user-1', {
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
    expect(repository.addMessages.mock.calls).toEqual([
      [expect.objectContaining({ version: 0 }), [result?.userMessage]],
      [expect.objectContaining({ version: 1 }), [result?.assistantMessage]],
    ])
  })

  it('passes earlier messages as history', async () => {
    const { agent, service } = createService(chatWith([question, answer]))

    await service.sendMessage('chat-1', 'user-1', { text: 'Tell me more' })

    expect(agent.chat).toHaveBeenCalledWith(
      [question, answer],
      'Tell me more',
      expect.any(AbortSignal),
    )
  })

  it('returns null when the user has no such chat', async () => {
    const { agent, repository, service } = createService(null)

    await expect(
      service.sendMessage('chat-1', 'user-2', { text: 'Hi' }),
    ).resolves.toBeNull()
    expect(repository.findById).toHaveBeenCalledWith('chat-1', 'user-2')
    expect(agent.chat).not.toHaveBeenCalled()
  })

  it('keeps the question and throws TurnTimeoutError when the turn times out', async () => {
    const { repository, service } = createService(
      chatWith([]),
      (_history, _message, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason))
        }),
    )

    await expect(
      service.sendMessage('chat-1', 'user-1', { text: 'Hi' }),
    ).rejects.toThrow(TurnTimeoutError)

    expect(repository.addMessages).toHaveBeenCalledTimes(1)
    expect(repository.addMessages.mock.calls[0][1]).toEqual([
      expect.objectContaining({ role: 'user', text: 'Hi' }),
    ])
  })

  it('throws AssistantUnavailableError when the agent fails', async () => {
    const { service } = createService(chatWith([]), async () => {
      throw new Error('429 You have no credits remaining')
    })

    await expect(
      service.sendMessage('chat-1', 'user-1', { text: 'Hi' }),
    ).rejects.toThrow(AssistantUnavailableError)
  })

  describe('with a clientId', () => {
    it('saves the clientId on the question', async () => {
      const { service } = createService(chatWith([]))

      const result = await service.sendMessage('chat-1', 'user-1', {
        clientId,
        text: 'Hi',
      })

      expect(result?.userMessage.clientId).toBe(clientId)
    })

    it('returns the saved answer for a repeated clientId without a new turn', async () => {
      const { agent, repository, service } = createService(
        chatWith([question, answer]),
      )

      await expect(
        service.sendMessage('chat-1', 'user-1', {
          clientId,
          text: 'Like Breaking Bad',
        }),
      ).resolves.toEqual({ assistantMessage: answer, userMessage: question })
      expect(agent.chat).not.toHaveBeenCalled()
      expect(repository.addMessages).not.toHaveBeenCalled()
    })

    it('answers the saved question again when the earlier turn failed', async () => {
      const { agent, repository, service } = createService(chatWith([question]))

      const retry = await service.sendMessage('chat-1', 'user-1', {
        clientId,
        text: 'Like Breaking Bad',
      })

      expect(retry?.userMessage).toEqual(question)
      expect(retry?.assistantMessage.replyTo).toBe('question')
      expect(agent.chat).toHaveBeenCalledWith(
        [],
        'Like Breaking Bad',
        expect.any(AbortSignal),
      )
      expect(repository.addMessages).toHaveBeenCalledTimes(1)
      expect(repository.addMessages.mock.calls[0][1]).toEqual([
        retry?.assistantMessage,
      ])
    })
  })
})
