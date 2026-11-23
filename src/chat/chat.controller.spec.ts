import {
  type INestApplication,
  StandardSchemaValidationPipe,
} from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { randomUUID } from 'node:crypto'
import request from 'supertest'

import { encodeCursor } from '../common/pagination/cursor.js'
import { PLACEHOLDER_USER_ID } from '../common/user-id.decorator.js'
import { AssistantUnavailableError } from './assistant-unavailable.error.js'
import { ChatController } from './chat.controller.js'
import { ChatService } from './chat.service.js'
import { TurnTimeoutError } from './turn-timeout.error.js'

describe('ChatController', () => {
  let app: INestApplication
  const createChat = vi.fn()
  const listChats = vi.fn()
  const getChat = vi.fn()
  const sendMessage = vi.fn()

  beforeEach(async () => {
    createChat.mockReset()
    listChats.mockReset()
    getChat.mockReset()
    sendMessage.mockReset()

    const module = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ChatService,
          useValue: { createChat, getChat, listChats, sendMessage },
        },
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

  const summary = {
    createdAt: new Date('2026-11-09T10:00:00Z'),
    id: randomUUID(),
    updatedAt: new Date('2026-11-09T10:05:00Z'),
    userId: PLACEHOLDER_USER_ID,
    version: 3,
  }
  const chat = { ...summary, messages: [] }

  describe('POST /api/chat', () => {
    it('creates a chat for the current user and returns its id', async () => {
      createChat.mockResolvedValue(chat)

      const response = await request(app.getHttpServer())
        .post('/api/chat')
        .expect(201)

      expect(createChat).toHaveBeenCalledWith(PLACEHOLDER_USER_ID)
      expect(response.body).toEqual({
        createdAt: '2026-11-09T10:00:00.000Z',
        id: chat.id,
      })
    })
  })

  describe('GET /api/chat', () => {
    it('returns a page of chats with only public fields', async () => {
      listChats.mockResolvedValue({ items: [summary], nextCursor: 'next' })

      const response = await request(app.getHttpServer())
        .get('/api/chat')
        .expect(200)

      expect(listChats).toHaveBeenCalledWith(PLACEHOLDER_USER_ID, { limit: 20 })
      expect(response.body).toEqual({
        items: [
          {
            createdAt: '2026-11-09T10:00:00.000Z',
            id: chat.id,
            updatedAt: '2026-11-09T10:05:00.000Z',
          },
        ],
        nextCursor: 'next',
      })
    })

    it('passes the limit and the decoded cursor on', async () => {
      listChats.mockResolvedValue({ items: [], nextCursor: null })
      const cursor = { id: chat.id, value: chat.createdAt }

      await request(app.getHttpServer())
        .get('/api/chat')
        .query({ cursor: encodeCursor(cursor), limit: 5 })
        .expect(200)

      expect(listChats).toHaveBeenCalledWith(PLACEHOLDER_USER_ID, {
        cursor,
        limit: 5,
      })
    })

    it.each([
      ['a bad cursor', { cursor: 'nope' }],
      ['a too large limit', { limit: 101 }],
      ['an unknown parameter', { page: 2 }],
    ])('rejects %s with 400', async (_case, query) => {
      await request(app.getHttpServer())
        .get('/api/chat')
        .query(query)
        .expect(400)

      expect(listChats).not.toHaveBeenCalled()
    })
  })

  describe('GET /api/chat/:id', () => {
    const question = {
      createdAt: new Date('2026-11-09T10:00:00Z'),
      id: randomUUID(),
      role: 'user',
      status: 'complete',
      text: 'Like Breaking Bad',
    }
    const answer = {
      createdAt: new Date('2026-11-09T10:00:05Z'),
      id: randomUUID(),
      kind: 'answer',
      replyTo: question.id,
      role: 'assistant',
      sources: [],
      status: 'complete',
      text: 'Try Better Call Saul.',
    }

    it('returns the chat with all its messages and only public fields', async () => {
      getChat.mockResolvedValue({ ...summary, messages: [question, answer] })

      const response = await request(app.getHttpServer())
        .get(`/api/chat/${chat.id}`)
        .expect(200)

      expect(getChat).toHaveBeenCalledWith(chat.id, PLACEHOLDER_USER_ID)
      expect(response.body).toEqual({
        createdAt: '2026-11-09T10:00:00.000Z',
        id: chat.id,
        messages: [
          { ...question, createdAt: '2026-11-09T10:00:00.000Z' },
          { ...answer, createdAt: '2026-11-09T10:00:05.000Z' },
        ],
        updatedAt: '2026-11-09T10:05:00.000Z',
      })
    })

    it('returns 404 for an unknown chat', async () => {
      getChat.mockResolvedValue(null)

      await request(app.getHttpServer()).get(`/api/chat/${chat.id}`).expect(404)
    })

    it('rejects a chat id that is not a UUID with 400', async () => {
      await request(app.getHttpServer()).get('/api/chat/not-a-uuid').expect(400)

      expect(getChat).not.toHaveBeenCalled()
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
