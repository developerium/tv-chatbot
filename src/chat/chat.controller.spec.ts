import {
  type INestApplication,
  StandardSchemaValidationPipe,
} from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { randomUUID } from 'node:crypto'
import request from 'supertest'

import { PLACEHOLDER_USER_ID } from '../common/user-id.decorator.js'
import { CHAT_REPOSITORY } from '../storage/chat.repository.js'
import { InMemoryChatRepository } from '../storage/in-memory-chat.repository.js'
import { AssistantUnavailableError } from './assistant-unavailable.error.js'
import { ChatController } from './chat.controller.js'
import { ChatService } from './chat.service.js'
import { TurnTimeoutError } from './turn-timeout.error.js'

describe('ChatController', () => {
  let app: INestApplication
  let repository: InMemoryChatRepository
  const sendMessage = vi.fn()

  beforeEach(async () => {
    repository = new InMemoryChatRepository()
    sendMessage.mockReset()

    const module = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ChatService,
          useFactory: () => ({
            createChat: (userId: string) => repository.create(userId),
            sendMessage,
          }),
        },
        { provide: CHAT_REPOSITORY, useValue: repository },
      ],
    }).compile()

    app = module.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new StandardSchemaValidationPipe())
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('POST /api/chat', () => {
    it('creates a chat for the current user and returns its id', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/chat')
        .expect(201)

      expect(response.body).toEqual({
        createdAt: expect.any(String),
        id: expect.any(String),
      })

      const chat = await repository.findById(
        response.body.id,
        PLACEHOLDER_USER_ID,
      )
      expect(chat?.createdAt.toISOString()).toBe(response.body.createdAt)
      expect(chat?.messages).toEqual([])
    })
  })

  describe('POST /api/chat/:id/message', () => {
    const chatId = randomUUID()
    const createdAt = new Date('2026-11-09T10:00:00Z')

    it('returns both messages with ISO dates', async () => {
      sendMessage.mockResolvedValue({
        assistantMessage: {
          createdAt,
          id: 'answer',
          kind: 'answer',
          replyTo: 'question',
          role: 'assistant',
          sources: [],
          status: 'complete',
          text: 'Try Better Call Saul.',
        },
        userMessage: {
          createdAt,
          id: 'question',
          role: 'user',
          status: 'complete',
          text: 'Like Breaking Bad',
        },
      })

      const response = await request(app.getHttpServer())
        .post(`/api/chat/${chatId}/message`)
        .send({ text: '  Like\u0007 Breaking Bad ' })
        .expect(201)

      expect(sendMessage).toHaveBeenCalledWith(chatId, PLACEHOLDER_USER_ID, {
        text: 'Like Breaking Bad',
      })
      expect(response.body.userMessage).toEqual({
        createdAt: '2026-11-09T10:00:00.000Z',
        id: 'question',
        role: 'user',
        status: 'complete',
        text: 'Like Breaking Bad',
      })
      expect(response.body.assistantMessage.replyTo).toBe('question')
    })

    it.each([
      ['an invalid chat id', 'not-a-uuid', { text: 'Hi' }],
      ['an empty text', chatId, { text: '   ' }],
      ['a too long text', chatId, { text: 'x'.repeat(2001) }],
      ['an unknown field', chatId, { id: 'mine', text: 'Hi' }],
      ['a clientId that is not a UUID', chatId, { clientId: '42', text: 'Hi' }],
    ])('rejects %s with 400', async (_case, id, body) => {
      await request(app.getHttpServer())
        .post(`/api/chat/${id}/message`)
        .send(body)
        .expect(400)

      expect(sendMessage).not.toHaveBeenCalled()
    })

    it('passes the clientId on', async () => {
      sendMessage.mockResolvedValue(null)
      const clientId = randomUUID()

      await request(app.getHttpServer())
        .post(`/api/chat/${chatId}/message`)
        .send({ clientId, text: 'Hi' })

      expect(sendMessage).toHaveBeenCalledWith(chatId, PLACEHOLDER_USER_ID, {
        clientId,
        text: 'Hi',
      })
    })

    it('returns 404 for an unknown chat', async () => {
      sendMessage.mockResolvedValue(null)

      await request(app.getHttpServer())
        .post(`/api/chat/${chatId}/message`)
        .send({ text: 'Hi' })
        .expect(404)
    })

    it('returns 504 when the turn times out', async () => {
      sendMessage.mockRejectedValue(new TurnTimeoutError())

      const response = await request(app.getHttpServer())
        .post(`/api/chat/${chatId}/message`)
        .send({ text: 'Hi' })
        .expect(504)

      expect(response.body.message).toContain('took too long')
    })

    it('returns 503 when the assistant is unavailable', async () => {
      sendMessage.mockRejectedValue(new AssistantUnavailableError())

      const response = await request(app.getHttpServer())
        .post(`/api/chat/${chatId}/message`)
        .send({ text: 'Hi' })
        .expect(503)

      expect(response.body.message).toContain('unavailable')
    })
  })
})
